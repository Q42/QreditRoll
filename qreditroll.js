const QreditRoll = (() => {
  let humansTxt = null;
  let frameReady = null;
  let frame = null;
  let client = null;
  let clientDomain = null;

  function init() {
    const scriptEl = document.querySelector('script[src*="qreditroll.js"]');
    if (!scriptEl) {
      console.error('Cannot determine domain of QreditRoll script');
      return;
    }
    clientDomain = new URL(scriptEl.src).origin;

    addKonamiListener();
    addEscapeListener();

    window.addEventListener('message', (event) => {
      if (event.origin === clientDomain) {
        switch (event.data.type) {
          case 'ready':
            client.postMessage({ type: 'passHumansTxt', humansTxt }, clientDomain);
            break;
          case 'stopQreditRoll':
            stop();
            break;
          default:
            if (!event.data.source || !event.data.source.includes('vue-devtools')) {
              console.log('messagehandler -> function not found:', event.data.type);
            }
        }
      };
    });
  }

  function fetchHumansTxt() {
    if (humansTxt !== null) {
      return Promise.resolve(humansTxt);
    }

    return fetch('/humans.txt', {
      method: 'GET',
      mode: 'same-origin',
      credentials: 'same-origin',
      referrerPolicy: 'same-origin'
    }).then(response => {
      if (!response.ok) {
        console.warn(`QreditRoll: could not load humans.txt (${response.status})`);
        return null;
      }
      return response.text();
    }).then(data => {
      if (!data || !data.trim()) {
        console.warn('QreditRoll: humans.txt is empty');
        return null;
      }
      humansTxt = data;
      return data;
    }).catch(err => {
      console.warn('QreditRoll: could not load humans.txt', err);
      return null;
    });
  }

  function createIFrame() {
    frameReady = new Promise((resolve) => {
      frame = document.createElement('iframe');
      frame.onload = () => resolve();
      frame.id = 'qreditrollframe';
      frame.title = 'QreditRoll';
      frame.src = `${clientDomain}/qreditroll.html?hostDomain=${encodeURI(window.location.origin)}`;
      frame.allow = 'autoplay';
      frame.style.cssText = `
                  border: none;
                  position: fixed;
                  z-index: 999999999;
                  width: 1px;
                  height: 1px;
                  top: 0;
                  right: 0;
                  overflow: hidden;
                  `;
      document.body.appendChild(frame);
      client = document.getElementById(frame.id).contentWindow;
    });
  }

  function addEscapeListener() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && frame) {
        client.postMessage({ type: 'stopQreditRoll' }, clientDomain);
      }
    });
  }

  function addKonamiListener() {
    const allowedKeys = { 'ArrowLeft': 'left', 'ArrowUp': 'up', 'ArrowRight': 'right', 'ArrowDown': 'down', 'a': 'a', 'b': 'b' };
    const konamiCode = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
    let konamiCodePosition = 0;

    document.addEventListener('keydown', (e) => {
      var key = allowedKeys[e.key];
      var requiredKey = konamiCode[konamiCodePosition];
      if (key == requiredKey) {
        konamiCodePosition++;
        if (konamiCodePosition == konamiCode.length) {
          start();
          konamiCodePosition = 0;
        }
      } else {
        konamiCodePosition = 0;
      }
    });
  }

  function start() {
    if (!frame) {
      createIFrame();
    }

    fetchHumansTxt().then(humansTxt => {
      if (!humansTxt) return;

      return frameReady.then(() => {
        frame.style.cssText = `
                  border: none;
                  position: fixed;
                  z-index: 999999999;
                  width: 100vw;
                  height: 100vh;
                  top: 0;
                  left: 0;
                  overflow: hidden;
                  `;

        client.postMessage({ type: 'startQreditRoll' }, clientDomain);
      });
    });
  }

  function stop() {
    if (!frame) {
      return;
    }

    frameReady.then(() => {
      frame.style.cssText = `
                  border: none;
                  position: fixed;
                  z-index: -1;
                  width: 1px;
                  height: 1px;
                  top: 0;
                  right: 0;
                  overflow: hidden;
                  `;
    });
  }

  init();
  return { start, stop };
})();
