const QreditRoll = new function() {
  fetch('/humans.txt', {
    method: 'GET',
    mode: 'same-origin',
    cache: 'no-cache',
    credentials: 'same-origin',
    referrerPolicy: 'same-origin'
  }).then(response => {
    response.text().then(data => this.init(data));
  });

  this.init = function(humansTxt) {
    //TODO check if humansTxt isn't empty

    const scriptEl = document.querySelector('script[src*="qreditroll.js"]');
    if (!scriptEl) {
      console.error('Cannot determine domain of QreditRoll script');
      return;
    }
    this.clientDomain = scriptEl.src.replace('/qreditroll.js', '');

    this.addKonamiListener();

    window.addEventListener('message', (event) => {
      if (event.origin.startsWith(this.clientDomain)) {
        switch (event.data.type) {
          case 'ready':
            this.client.postMessage({ type: 'passHumansTxt', humansTxt: humansTxt }, this.clientDomain);
            break;
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
  }

  this.createIFrame = function() {
    this.frame = document.createElement('iframe');

    this.frame.onload = () => {
      this.frameLoaded = true;
    }

    this.frame.id = 'qreditrollframe';
    this.frame.title = 'QreditRoll';
    this.frame.src = `${this.clientDomain}/qreditroll.html?hostDomain=${encodeURI(window.location.origin)}`;
    this.frame.allowtransparancy = 'true';
    this.frame.allow = 'autoplay';
    this.frame.style = `
                  border: none;
                  position: fixed;
                  z-index: 999999999;
                  width: 1px;
                  height: 1px;
                  top: 0;
                  right: 0;
                  overflow: hidden;
                  `;
    document.body.appendChild(this.frame);
    this.client = document.getElementById(this.frame.id).contentWindow;
  }

  this.addKonamiListener = function() {
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
  }

  this.start = function() {
    if (!this.frame) {
      this.createIFrame();
    }

    if (!this.frameLoaded) {
      setTimeout(() => { this.start() }, 100);
      return;
    }

    this.frame.style = `
                  border: none;
                  position: fixed;
                  z-index: 999999999;
                  width: 100vw;
                  height: 100vh;
                  top: 0;
                  left: 0;
                  overflow: hidden;
                  `;

    this.client.postMessage({ type: 'startQreditRoll' }, this.clientDomain);
  };

  this.stop = function() {
    if (!this.frame) {
      return;
    }

    if (!this.frameLoaded) {
      setTimeout(() => { this.stop() }, 100);
      return;
    }

    this.frame.style = `
                  border: none;
                  position: fixed;
                  width: 1px;
                  height: 1px;
                  top: 0;
                  right: 0;
                  overflow: hidden;
                  `;
  }
}();
