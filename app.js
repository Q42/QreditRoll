let qredits = '';
let hostDomain = '';
let lines = 0;
let timeout = null;

document.addEventListener('DOMContentLoaded', (event) => {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);

  if (params.has('hostDomain')) {
    hostDomain = decodeURI(params.get('hostDomain') || '');
    if (hostDomain.endsWith('/')) {
      hostDomain = hostDomain.slice(0, -1);
    }
    const humansTxtUrl = `${hostDomain}/humans.txt`; //https://cors-anywhere.herokuapp.com/${hostDomain}/humans.txt`;
    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        handleHumansTxt(xhttp.responseText);
      }
    };
    xhttp.open('GET', humansTxtUrl);
    xhttp.send();
  }

  document.getElementById('close').addEventListener('click', (event) => {
    stopQredits();
  })
});

window.addEventListener('message', (event) => {
  if (event.origin.startsWith(hostDomain)) {
    switch (event.data.type) {
      case 'startQredits':
        startQredits();
        break;
      default:
        if (!event.data.source || event.data.source.indexOf('vue-devtools') == -1) {
          console.log('messagehandler -> function not found:', event.data.type);
        }
    }
  };
});

function handleHumansTxt(humansTxt) {
  humansTxt.split("\n").forEach((line, index, arr) => {
    if (index === arr.length - 1 && line === "") {
      return;
    }

    lines++;

    if (line.indexOf('/*') > -1 && line.indexOf('*/') > -1) {
      qredits += line.replace('/*', '<h2>').replace('*/', '</h2>');
    } else if (line.length > 0) {
      qredits += `<p>${line}</p>`;
    } else {
      qredits += '</br>';
    }
  });
}

function startQredits() {
  // TODO check if humans.txt loaded successfully

  const player = document.getElementById('player');
  player.volume = 1;
  player.play();

  const qreditsEl = document.getElementById('qredits');
  qreditsEl.innerHTML = qredits;
  qreditsEl.style.transition = `transform ${lines}s linear 2s`;

  document.body.classList.add('active');

  timeout = setTimeout(function() {
    stopQredits();
  }, (lines + 4) * 1000);
}

function stopQredits() {
  clearTimeout(timeout);
  timeout = null;

  document.body.classList.remove('active');

  const player = document.getElementById('player');
  let vol = 1;
  const fadeout = setInterval(function() {
    if (vol > 0) {
      vol -= 0.05;
      if (vol < 0) {
        vol = 0;
      }
      player.volume = vol;
    }
    else {
      player.pause();
      player.currentTime = 0;

      parent.postMessage({ type: 'stopQredits' }, hostDomain);

      clearInterval(fadeout);
    }
  }, 80);
}
