let hostDomain = null;
let stopTimeout = null;
let scrollTimeout = null;
let notifyHumansTxtReady;
const humansTxtReady = new Promise(resolve => { notifyHumansTxtReady = resolve; });
let themeReady = Promise.resolve();
let notifyMusicPassed;
const musicPassed = new Promise(resolve => { notifyMusicPassed = resolve; });
let customMusic = false;
let qreditsEl = null;

// 'idle' -> 'loading' (start asked, audio loading) -> 'rolling' -> 'closing' (fading out) -> 'idle'
let state = 'idle';
let scrollDirection = 0;
// Decided at the start of each roll: with reduced motion the roll stands still and the page scrolls
let reducedMotion = false;
let scrollFrame = null;
let touchY = 0;

const scrollKeys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
// How long (ms) the browser gets to start the sound before the roll goes on without it
const AUDIO_BLOCKED_WAIT = 500;
// Reduced motion: px per second the page scrolls while a direction is held
const PAGE_SCROLL_SPEED = 600;

// Web Audio API
let audioContext = null;
let audioLoading = null;
let audioBuffer = null;
let audioBufferReversed = null;
let audioSource = null;
let gainNode = null;
let audioStartContextTime = 0;
let audioStartOffset = 0;
let currentPlaybackRate = 1;
// True when this roll runs without sound: no music, or the browser blocked it
let silent = false;

document.addEventListener('DOMContentLoaded', ready);
document.body.addEventListener("wheel", scrollHandler, { passive: false });
document.body.addEventListener('touchstart', (event) => { touchY = event.touches[0].clientY; }, { passive: true });
document.body.addEventListener('touchmove', touchHandler, { passive: false });
document.addEventListener('keydown', (event) => {
  if (scrollKeys[event.key] && !(event.altKey || event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    scrollQreditRoll(scrollKeys[event.key]);
  }
});
document.addEventListener('keyup', (event) => {
  if (scrollKeys[event.key]) {
    scrollQreditRoll(0);
  }
});
window.addEventListener('message', handleMessage);

function ready() {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);

  if (!params.has('hostDomain')) {
    console.error('Cannot determine domain of host page');
    return;
  }

  hostDomain = decodeURI(params.get('hostDomain'));
  if (hostDomain.endsWith('/')) {
    hostDomain = hostDomain.slice(0, -1);
  }

  loadTheme(params.get('theme'));
  customMusic = params.has('music');
  if (customMusic) {
    document.getElementById('funnySong').remove();
  }

  parent.postMessage({ type: 'ready' }, hostDomain);
}

// The site's stylesheet comes after style.css, so it only has to hold what it changes
function loadTheme(url) {
  if (!url || !/^https?:/.test(url)) return;

  themeReady = new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = resolve;
    link.onerror = () => {
      console.warn('QreditRoll: could not load theme', url);
      resolve();
    };
    document.head.appendChild(link);
  });
}

function init(humansTxt) {
  document.getElementById('close').addEventListener('click', stopQreditRoll);
  qreditsEl = document.getElementById('qredits');
  qreditsEl.addEventListener('transitionend', () => {
    const y = parseInt(getTranslateValues(qreditsEl).y);
    const height = parseInt(window.getComputedStyle(qreditsEl).height);
    if (state === 'rolling' && height + y <= 0) {
      stopTimeout = setTimeout(stopQreditRoll, 1000);
    }
  });

  const humansTxtEl = document.getElementById('humansTxtQredits');
  humansTxtEl.replaceChildren(convertHumansTxtToHtml(humansTxt));
  notifyHumansTxtReady();
}

function convertHumansTxtToHtml(humansTxt) {
  const fragment = document.createDocumentFragment();
  humansTxt.split(/\r?\n/).forEach((line, index, arr) => {
    if (index === arr.length - 1 && line === "") {
      return;
    }

    if (line.indexOf('/*') > -1 && line.indexOf('*/') > -1) {
      const el = document.createElement('h2');
      el.textContent = line.replace('/*', '').replace('*/', '');
      fragment.appendChild(el);
    } else if (line.length > 0) {
      const el = document.createElement('p');
      el.textContent = line;
      fragment.appendChild(el);
    } else {
      fragment.appendChild(document.createElement('br'));
    }
  });

  return fragment;
}

function initAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    audioLoading = loadAudio();
  }

  gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  gainNode.gain.value = 1;
  // A roll that starts while the music is still loading waits for it too
  return audioLoading;
}

async function loadAudio() {
  try {
    const arrayBuffer = await fetchMusic();

    // Wrap decodeAudioData in a Promise to support older Safari versions that only support the callback syntax
    audioBuffer = await new Promise((resolve, reject) => {
      audioContext.decodeAudioData(arrayBuffer, resolve, reject);
    });
    
    audioBufferReversed = createReversedBuffer(audioBuffer);
  } catch (err) {
    console.warn('QreditRoll: audio failed to load', err);
  }
}

// The site's own music is handed over by the host page, the Funny Song is fetched here
async function fetchMusic() {
  if (customMusic) {
    const music = await musicPassed;
    if (!music) throw new Error('the host page could not load the music');
    return music;
  }

  const response = await fetch('bensound-funnysong.mp3');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.arrayBuffer();
}

// Whether the browser lets the sound play (autoplay policy). It gives no signal when it does not,
// so the wait ends by itself
async function audioAllowed() {
  if (audioContext.state === 'running') return true;

  return Promise.race([
    audioContext.resume().then(() => audioContext.state === 'running', () => false),
    new Promise(resolve => setTimeout(resolve, AUDIO_BLOCKED_WAIT, false))
  ]);
}

function createReversedBuffer(buffer) {
  const reversed = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    const reversedData = reversed.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      reversedData[i] = data[buffer.length - 1 - i];
    }
  }
  return reversed;
}

function playAudio(offset, rate) {
  if (!audioContext || silent) return;

  const reversed = rate < 0;
  const buffer = reversed ? audioBufferReversed : audioBuffer;
  if (!buffer) return;

  stopAudioSource();

  audioSource = audioContext.createBufferSource();
  audioSource.buffer = buffer;
  audioSource.playbackRate.value = Math.abs(rate);
  audioSource.connect(gainNode);

  // For reversed playback, map forward offset to position in the reversed buffer
  const reversedOffset = reversed ? buffer.duration - offset : offset;
  const clampedOffset = Math.max(0, Math.min(reversedOffset, buffer.duration));
  audioStartContextTime = audioContext.currentTime;
  audioStartOffset = offset;
  currentPlaybackRate = rate;

  audioSource.start(0, clampedOffset);
}

function stopAudioSource() {
  if (audioSource) {
    try { audioSource.stop(); } catch (e) {}
    audioSource.disconnect();
    audioSource = null;
  }
}

function getCurrentAudioOffset() {
  if (!audioContext || !audioBuffer) return 0;
  const elapsed = audioContext.currentTime - audioStartContextTime;
  return Math.max(0, Math.min(
    audioStartOffset + elapsed * currentPlaybackRate,
    audioBuffer.duration
  ));
}

function setAudioPlaybackRate(rate) {
  if (!audioBuffer || !audioContext) return;
  if (rate === currentPlaybackRate && audioSource) return;
  playAudio(getCurrentAudioOffset(), rate);
}

function startQreditRoll() {
  if (state !== 'idle') return;
  state = 'loading';

  humansTxtReady.then(() => themeReady).then(() => {
    // This timeout gives the browser time to render the original transform property correctly,
    // before changing it in setQreditsTransition
    setTimeout(async function() {
      const loading = initAudio();
      // Asked right away, so the wait for a browser that blocks sound runs while the music loads
      const allowed = audioAllowed();
      await loading;
      const plays = audioBuffer !== null && (audioContext.state === 'running' || await allowed);

      // Closed while loading, or a later start got here first
      if (state !== 'loading') return;
      state = 'rolling';

      silent = !plays;
      playAudio(0, 1);

      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.body.classList.toggle('reduced-motion', reducedMotion);
      window.scrollTo(0, 0);
      if (!reducedMotion) {
        setQreditsTransition(false, true);
      }

      document.body.classList.add('active');
      parent.postMessage({ type: 'startedQreditRoll', silent }, hostDomain);
    }, 10);
  });
}

function stopQreditRoll() {
  if (state === 'closing') return;

  clearTimeout(stopTimeout);
  stopTimeout = null;

  // Nothing to fade out; a roll that is still loading sees the state and gives up
  if (state !== 'rolling') {
    stopped();
    return;
  }

  scrollQreditRoll(0);
  state = 'closing';
  document.body.classList.remove('active');

  const now = audioContext.currentTime;
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(0, now + 1.6);
  setTimeout(() => {
    stopAudioSource();
    // Back to the starting position, so nothing keeps moving in the hidden frame
    qreditsEl.style.transition = '';
    qreditsEl.style.transform = '';
    stopped();
  }, 1600);
}

function stopped() {
  state = 'idle';
  parent.postMessage({ type: 'stopQreditRoll' }, hostDomain);
}

function setQreditsTransition(fast, delayed) {
  const y = parseInt(getTranslateValues(qreditsEl).y);
  const height = parseInt(window.getComputedStyle(qreditsEl).height);
  const distanceLeft = height + y;
  const speedFactor = fast ? 15 : 1;

  const duration = distanceLeft / 50 / speedFactor;
  const delay = delayed ? 2 : 0;
  qreditsEl.style.transition = `transform ${duration}s linear ${delay}s`;

  // For the changed duration to work for a transition in progress, we have to change the transitioning property
  if (fast) {
    qreditsEl.style.transform = 'translateY(-99.9999%)';
  } else {
    qreditsEl.style.transform = 'translateY(-100%)';
  }
}

function scrollHandler(event) {
  scrollPulse(event, event.deltaY);
}

function touchHandler(event) {
  const y = event.touches[0].clientY;
  scrollPulse(event, touchY - y);
  touchY = y;
}

// Wheel and finger come as a stream of events: scroll while they come in, back to normal when they stop
function scrollPulse(event, delta) {
  // With reduced motion the page scrolls the native way
  if (reducedMotion) return;

  event.preventDefault();
  if (!delta) return;

  scrollQreditRoll(delta);
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => scrollQreditRoll(0), 42);
}

// Keeps going in a direction until told otherwise: 1 fast-forwards, -1 rewinds, 0 is the normal roll
function scrollQreditRoll(direction) {
  direction = Math.sign(direction) || 0;
  if (state !== 'rolling' || direction === scrollDirection) return;
  scrollDirection = direction;

  if (reducedMotion) {
    cancelAnimationFrame(scrollFrame);
    scrollPage(performance.now());
    return;
  }

  document.body.classList.toggle('scrolling', direction !== 0);
  if (direction > 0) {
    setQreditsTransition(true);
    setAudioPlaybackRate(1.5);
  } else if (direction < 0) {
    scrollBackward();
    setAudioPlaybackRate(-2);
  } else {
    setQreditsTransition(false);
    setAudioPlaybackRate(1);
  }
}

function scrollBackward() {
  const y = parseInt(getTranslateValues(qreditsEl).y);
  const distance = Math.max(window.innerHeight - y, 0);
  qreditsEl.style.transition = `transform ${distance / 1000}s linear`;
  qreditsEl.style.transform = `translateY(${window.innerHeight}px)`;
}

function scrollPage(since) {
  if (!scrollDirection) return;

  scrollFrame = requestAnimationFrame((now) => {
    window.scrollBy(0, scrollDirection * PAGE_SCROLL_SPEED * (now - since) / 1000);
    scrollPage(now);
  });
}

function handleMessage(event) {
  if (hostDomain && event.origin === hostDomain) {
    switch (event.data.type) {
      case 'passHumansTxt':
        init(event.data.humansTxt);
        break;
      case 'passMusic':
        notifyMusicPassed(event.data.music);
        break;
      case 'startQreditRoll':
        startQreditRoll();
        break;
      case 'scrollQreditRoll':
        scrollQreditRoll(event.data.direction);
        break;
      case 'stopQreditRoll':
        stopQreditRoll();
        break;
      default:
        if (!event.data.source || !event.data.source.includes('vue-devtools')) {
          console.log('messagehandler -> function not found:', event.data.type);
        }
    }
  }
}

/**
 * Gets computed translate values
 * @param {HTMLElement} element
 * @returns {Object}
 */
function getTranslateValues(element) {
  const style = window.getComputedStyle(element)
  const matrix = style.transform || style.webkitTransform || style.mozTransform

  // No transform property. Simply return 0 values.
  if (matrix === 'none') {
    return {
      x: 0,
      y: 0,
      z: 0
    }
  }

  // Can either be 2d or 3d transform
  const matrixType = matrix.includes('3d') ? '3d' : '2d'
  const matrixMatch = matrix.match(/matrix.*\((.+)\)/)
  if (!matrixMatch) {
    return { x: 0, y: 0, z: 0 }
  }
  const matrixValues = matrixMatch[1].split(', ')

  // 2d matrices have 6 values
  // Last 2 values are X and Y.
  // 2d matrices does not have Z value.
  if (matrixType === '2d') {
    return {
      x: matrixValues[4],
      y: matrixValues[5],
      z: 0
    }
  }

  // 3d matrices have 16 values
  // The 13th, 14th, and 15th values are X, Y, and Z
  if (matrixType === '3d') {
    return {
      x: matrixValues[12],
      y: matrixValues[13],
      z: matrixValues[14]
    }
  }
}
