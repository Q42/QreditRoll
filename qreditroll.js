const QreditRoll = new function() {
  this.humansTxt = null;
  this.frameReady = null;

  this.init = function() {
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
            this.client.postMessage({ type: 'passHumansTxt', humansTxt: this.humansTxt }, this.clientDomain);
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

  this.fetchHumansTxt = function() {
    if (this.humansTxt !== null) {
      return Promise.resolve(this.humansTxt);
    }

    return fetch('/humans.txt', {
      method: 'GET',
      mode: 'same-origin',
      cache: 'no-cache',
      credentials: 'same-origin',
      referrerPolicy: 'same-origin'
    }).then(response => response.text()).then(data => {
      if (!data || !data.trim()) {
        console.warn('QreditRoll: humans.txt is empty');
        return null;
      }
      this.humansTxt = data;
      return data;
    }).catch(err => {
      console.warn('QreditRoll: could not load humans.txt', err);
      return null;
    });
  }

  this.createIFrame = function() {
    this.frameReady = new Promise((resolve) => {
      this.frame = document.createElement('iframe');
      this.frame.onload = () => resolve();
      this.frame.id = 'qreditrollframe';
      this.frame.title = 'QreditRoll';
      this.frame.src = `${this.clientDomain}/qreditroll.html?hostDomain=${encodeURI(window.location.origin)}`;
      this.frame.allow = 'autoplay';
      this.frame.style.cssText = `
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
    });
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

    this.fetchHumansTxt().then(humansTxt => {
      if (!humansTxt) return;

      return this.frameReady.then(() => {
        this.frame.style.cssText = `
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
      });
    });
  };

  this.stop = function() {
    if (!this.frame) {
      return;
    }

    this.frameReady.then(() => {
      this.frame.style.cssText = `
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

  this.init();
}();
