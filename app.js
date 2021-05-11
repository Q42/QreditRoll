let hostDomain = null;
let lines = 0;
let stopTimeout = null;
let scrollTimeout = null;
let humansTxtLoaded = false;
let qreditsEl = null;
let audioPlayer = null;

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
  qreditsEl.addEventListener('transitionend', (event) => {
    stopTimeout = setTimeout(stopQreditRoll, 1000);
  });

  const qredits = convertHumansTxtToHtml(humansTxt);
  const humansTxtEl = document.getElementById('humansTxtQredits');
  humansTxtEl.innerHTML = qredits;
}

function convertHumansTxtToHtml(humansTxt) {
  let html = '';
  humansTxt.split("\n").forEach((line, index, arr) => {
    if (index === arr.length - 1 && line === "") {
      return;
    }

    lines++;

    if (line.indexOf('/*') > -1 && line.indexOf('*/') > -1) {
      html += line.replace('/*', '<h2>').replace('*/', '</h2>');
    } else if (line.length > 0) {
      html += `<p>${line}</p>`;
    } else {
      html += '<br>';
    }
  });

  humansTxtLoaded = true;

  return html;
}

function startQreditRoll() {
  if (!humansTxtLoaded) {
    setTimeout(startQreditRoll, 100);
    return;
  }

  // This timeout gives the browser time to render the original transform property correctly,
  // before changing it in setQreditsTransition
  setTimeout(function() {
    audioPlayer = document.getElementById('player');
    audioPlayer.volume = 1;
    audioPlayer.play();

    setQreditsTransition(false, true);

    document.body.classList.add('active');
  }, 10);
}

function stopQreditRoll() {
  clearTimeout(stopTimeout);
  stopTimeout = null;

  document.body.classList.remove('active');

  setTimeout(() => {
    qreditsEl.style.transition = '';
    qreditsEl.style.transform = '';
  }, 2000);

  let vol = 1;
  const fadeout = setInterval(function() {
    if (vol > 0) {
      vol -= 0.05;
      if (vol < 0) {
        vol = 0;
      }
      audioPlayer.volume = vol;
    }
    else {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;

      parent.postMessage({ type: 'stopQreditRoll' }, hostDomain);

      clearInterval(fadeout);
    }
  }, 80);
}

function setQreditsTransition(fast, delayed) {
  const y = parseInt(getTranslateValues(qreditsEl).y);
  const height = parseInt(window.getComputedStyle(qreditsEl).height.replace('px', ''));
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

  if (event.deltaY <= 0) {
    return;
  }

  if (!document.body.classList.contains('scrolling')) {
    document.body.classList.add('scrolling');
    setQreditsTransition(true);
    audioPlayer.playbackRate = 2;
  }

  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    document.body.classList.remove('scrolling');
    setQreditsTransition(false);
    audioPlayer.playbackRate = 1;
  }, 42);
}

function handleMessage() {
  if (hostDomain && event.origin.startsWith(hostDomain)) {
    switch (event.data.type) {
      case 'passHumansTxt':
        init(event.data.humansTxt);
        break;
      case 'startQreditRoll':
        startQreditRoll();
        break;
      default:
        if (!event.data.source || event.data.source.indexOf('vue-devtools') == -1) {
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
  const matrixValues = matrix.match(/matrix.*\((.+)\)/)[1].split(', ')

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
