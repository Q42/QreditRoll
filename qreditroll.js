QreditRollInstance = function() {
  let clientDomain = null;
  let client = null;

  const scriptEl = document.querySelector('script[src*="/qreditroll.js"]');
  if (scriptEl) {
    clientDomain = scriptEl.src.replace('/qreditroll.js', '');
  }

  let frame = document.createElement('iframe');
  frame.id = 'qreditrollframe';
  frame.src = `${clientDomain}?hostDomain=${encodeURI(window.location.origin)}`;
  frame.allowtransparancy = 'true';
  frame.allow = 'autoplay';
  frame.style = `
                border: none;
                position: fixed;
                width: 1px;
                height: 1px;
                top: 0;
                right: 0;
                overflow: hidden;
                `;
  document.body.appendChild(frame);
  client = document.getElementById(frame.id).contentWindow;

  const allowedKeys = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 65: 'a', 66: 'b' };
  const konamiCode = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
  let konamiCodePosition = 0;

  document.addEventListener('keydown', (e) => {
    var key = allowedKeys[e.keyCode];
    var requiredKey = konamiCode[konamiCodePosition];
    if (key == requiredKey) {
      konamiCodePosition++;
      if (konamiCodePosition == konamiCode.length) {
        this.start();
        konamiCodePosition = 0;
      }
    } else {
      konamiCodePosition = 0;
    }
  });

  window.addEventListener('message', (event) => {
    if (event.origin.startsWith(clientDomain)) {
      switch (event.data.type) {
        case 'stopQreditRoll':
          this.stop();
          break;
        default:
          if (!event.data.source || event.data.source.indexOf('vue-devtools') == -1) {
            console.log('messagehandler -> function not found:', event.data.type);
          }
      }
    };
  });

  this.start = function() {
    frame.style = `
                  border: none;
                  position: fixed;
                  width: 100vw;
                  height: 100vh;
                  top: 0;
                  left: 0;
                  overflow: hidden;
                  `;

    client.postMessage({ type: 'startQreditRoll' }, clientDomain);
  };

  this.stop = function() {
    frame.style = `
                  border: none;
                  position: fixed;
                  width: 1px;
                  height: 1px;
                  top: 0;
                  right: 0;
                  overflow: hidden;
                  `;
  }
};

const QreditRoll = new QreditRollInstance();
