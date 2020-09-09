let hostDomain = null;
let lines = 0;
let timeout = null;
let humansTxtLoaded = false;

document.addEventListener('DOMContentLoaded', (event) => {
  document.getElementById('close').addEventListener('click', (event) => {
    stopQreditRoll();
  })
  document.getElementById('qredits').addEventListener('transitionend', (event) => {
    timeout = setTimeout(stopQreditRoll, 1000);
  });

  initQreditRoll();
});

window.addEventListener('message', (event) => {
  if (hostDomain && event.origin.startsWith(hostDomain)) {
    switch (event.data.type) {
      case 'startQreditRoll':
        startQreditRoll();
        break;
      default:
        if (!event.data.source || event.data.source.indexOf('vue-devtools') == -1) {
          console.log('messagehandler -> function not found:', event.data.type);
        }
    }
  };
});

function initQreditRoll() {
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
  let humansTxtUrl = `https://cors-anywhere.herokuapp.com/${hostDomain}/humans.txt`;
  console.log(1, humansTxtUrl);
  if (hostDomain.indexOf('//localhost') > -1) {
    console.log(2, hostDomain);
    humansTxtUrl = `${hostDomain}/humans.txt`;
  }
  console.log(3, hostDomain, humansTxtUrl);

  const xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4) {
      if (this.status == 200) {
        const qredits = convertHumansTxtToHtml(xhttp.responseText);
        const humansTxtEl = document.getElementById('humansTxtQredits');
        humansTxtEl.innerHTML = qredits;
      } else {
        console.error('Cannot retrieve humans.txt', xhttp);
      }
    }
  };
  xhttp.open('GET', humansTxtUrl);
  xhttp.send();
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

  const player = document.getElementById('player');
  player.volume = 1;
  player.play();

  const qreditsEl = document.getElementById('qredits');
  qreditsEl.style.transition = `transform ${lines}s linear 2s`;

  document.body.classList.add('active');
}

function stopQreditRoll() {
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

      parent.postMessage({ type: 'stopQreditRoll' }, hostDomain);

      clearInterval(fadeout);
    }
  }, 80);
}
