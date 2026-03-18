let hostDomain = null;
let stopTimeout = null;
let scrollTimeout = null;
let notifyHumansTxtReady;
const humansTxtReady = new Promise(resolve => { notifyHumansTxtReady = resolve; });
let qreditsEl = null;

// Web Audio API
let audioContext = null;
let audioBuffer = null;
let audioBufferReversed = null;
let audioSource = null;
let gainNode = null;
let audioStartContextTime = 0;
let audioStartOffset = 0;
let currentPlaybackRate = 1;

document.addEventListener('DOMContentLoaded', ready);
document.body.addEventListener("mousewheel", scrollHandler, { passive: false }); // IE9, Chrome, Safari, Opera
document.body.addEventListener("DOMMouseScroll", scrollHandler, { passive: false }); // Firefox
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

  parent.postMessage({ type: 'ready' }, hostDomain);
}

function init(humansTxt) {
  document.getElementById('close').addEventListener('click', stopQreditRoll);
  qreditsEl = document.getElementById('qredits');
  qreditsEl.addEventListener('transitionend', () => {
    const y = parseInt(getTranslateValues(qreditsEl).y);
    const height = parseInt(window.getComputedStyle(qreditsEl).height);
    if (height + y <= 0) {
      stopTimeout = setTimeout(stopQreditRoll, 1000);
    }
  });

  const humansTxtEl = document.getElementById('humansTxtQredits');
  humansTxtEl.replaceChildren(convertHumansTxtToHtml(humansTxt));
  notifyHumansTxtReady();
}

function convertHumansTxtToHtml(humansTxt) {
  const fragment = document.createDocumentFragment();
  humansTxt.split("\n").forEach((line, index, arr) => {
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

async function initAudio() {
  if (audioContext) {
    gainNode.gain.cancelScheduledValues(audioContext.currentTime);
    gainNode.gain.value = 1;
    return;
  }

  audioContext = new AudioContext();
  gainNode = audioContext.createGain();
  gainNode.gain.value = 1;
  gainNode.connect(audioContext.destination);

  try {
    const response = await fetch('bensound-funnysong.mp3');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBufferReversed = createReversedBuffer(audioBuffer);
  } catch (err) {
    console.warn('QreditRoll: audio failed to load', err);
  }
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
  if (!audioContext) return;

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
  humansTxtReady.then(() => {
    // This timeout gives the browser time to render the original transform property correctly,
    // before changing it in setQreditsTransition
    setTimeout(async function() {
      await initAudio();
      playAudio(0, 1);

      setQreditsTransition(false, true);

      document.body.classList.add('active');
    }, 10);
  });
}

function stopQreditRoll() {
  clearTimeout(stopTimeout);
  stopTimeout = null;

  document.body.classList.remove('active');

  setTimeout(() => {
    qreditsEl.style.transition = '';
    qreditsEl.style.transform = '';
  }, 2000);

  if (gainNode && audioContext) {
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 1.6);
    setTimeout(() => {
      stopAudioSource();
      parent.postMessage({ type: 'stopQreditRoll' }, hostDomain);
    }, 1600);
  } else {
    parent.postMessage({ type: 'stopQreditRoll' }, hostDomain);
  }
}

function setQreditsTransition(fast, delayed) {
  const y = parseInt(getTranslateValues(qreditsEl).y);
  const height = parseInt(window.getComputedStyle(qreditsEl).height);
  const distanceLeft = height + y;
  const speedFactor = fast ? 15 : 1;

  let duration = distanceLeft / 50 / speedFactor;
  let delay = delayed ? 2 : 0;
  qreditsEl.style.transition = `transform ${duration}s linear ${delay}s`;

  // For the changed duration to work for a transition in progress, we have to change the transitioning property
  if (fast) {
    qreditsEl.style.transform = 'translateY(-99.9999%)';
  } else {
    qreditsEl.style.transform = 'translateY(-100%)';
  }
}

function scrollHandler(event) {
  event.preventDefault();

  if (event.deltaY > 0) {
    if (!document.body.classList.contains('scrolling')) {
      document.body.classList.add('scrolling');
      setQreditsTransition(true);
    }
    setAudioPlaybackRate(1.5);

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      document.body.classList.remove('scrolling');
      setQreditsTransition(false);
      setAudioPlaybackRate(1);
    }, 42);
  } else if (event.deltaY < 0) {
    if (!document.body.classList.contains('scrolling')) {
      document.body.classList.add('scrolling');
    }
    setAudioPlaybackRate(-2);
    scrollBackward();

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      document.body.classList.remove('scrolling');
      setQreditsTransition(false);
      setAudioPlaybackRate(1);
    }, 42);
  }
}

function scrollBackward() {
  const y = parseInt(getTranslateValues(qreditsEl).y);
  const newY = Math.min(y + 200, window.innerHeight);
  qreditsEl.style.transition = 'transform 0.2s linear';
  qreditsEl.style.transform = `translateY(${newY}px)`;
}

function handleMessage(event) {
  if (hostDomain && event.origin === hostDomain) {
    switch (event.data.type) {
      case 'passHumansTxt':
        init(event.data.humansTxt);
        break;
      case 'startQreditRoll':
        startQreditRoll();
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
