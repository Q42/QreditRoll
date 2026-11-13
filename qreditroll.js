// var and not const: a page that loads this script a second time must not get a syntax error
var QreditRoll = (() => {
  // Loaded before: the first script tag and its options stay in charge. Kept under a key of its own:
  // window.QreditRoll can also be an element with that id, or something the page put there itself
  const loadedKey = Symbol.for('QreditRoll');
  if (window[loadedKey]) {
    return window[loadedKey];
  }

  let humansTxt = null;
  let humansTxtPassed = false;
  let frameReady = null;
  let notifyFrameAnnounced = null;
  // False for an older cached frame, which does not report when the roll starts
  let frameReportsStart = false;
  let frame = null;
  let client = null;
  let clientDomain = null;
  let theme = null;
  let music = null;
  // Asked with start({ silent: true }): this roll plays no sound. Decided anew at every start()
  let startSilent = false;

  // 'idle' -> 'loading' (start() was called) -> 'open' (the frame is showing) -> 'idle'
  let state = 'idle';
  // True between the qreditroll:start and qreditroll:stop events
  let rolling = false;
  // What had the keyboard focus on the page when the roll opened
  let focusBefore = null;
  let stopTimer = null;

  // How long (ms) the frame gets to fade out (1.6 s) and report back, before the page closes the roll itself
  const STOP_WAIT = 3000;
  const scrollKeys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

  // Sla het huidige script element meteen op tijdens de eerste (synchrone) uitvoer
  const currentScript = document.currentScript;

  function init() {
    const scriptEl = currentScript || document.querySelector('script[src*="qreditroll.js"]');
    if (!scriptEl) {
      console.error('Cannot determine domain of QreditRoll script');
      return;
    }
    clientDomain = new URL(scriptEl.src).origin;
    theme = resolveUrl(scriptEl.dataset.theme);
    music = resolveUrl(scriptEl.dataset.music);

    if (scriptEl.dataset.konami !== 'off') {
      addKonamiListener();
    }
    addKeyListeners();

    window.addEventListener('message', (event) => {
      if (client && event.origin === clientDomain && event.source === client) {
        switch (event.data.type) {
          case 'ready':
            frameReportsStart = event.data.reportsStart === true;
            notifyFrameAnnounced();
            break;
          case 'startedQreditRoll':
            frame.style.pointerEvents = '';
            rolling = true;
            notify('start');
            if (event.data.silent) {
              notify('silent');
            }
            break;
          case 'stopQreditRoll':
            hide();
            break;
          default:
            if (!event.data.source || !event.data.source.includes('vue-devtools')) {
              console.log('messagehandler -> function not found:', event.data.type);
            }
        }
      };
    });
  }

  function resolveUrl(url) {
    if (!url) {
      return null;
    }
    try {
      return new URL(url, document.baseURI).href;
    } catch (err) {
      console.warn('QreditRoll: not a valid URL', url);
      return null;
    }
  }

  function notify(name) {
    document.dispatchEvent(new CustomEvent(`qreditroll:${name}`));
  }

  // A <link rel="author"> on this site comes first; the root is used when the page has none,
  // or when the link does not lead to a text file
  async function fetchHumansTxt() {
    if (humansTxt === null) {
      const root = resolveUrl('/humans.txt');
      const linked = [...document.querySelectorAll('link[rel~="author"][href]')]
        .map(link => link.href)
        .filter(url => url !== root && url.startsWith(`${window.location.origin}/`));

      for (const url of [...linked, root]) {
        humansTxt = await fetchTextFile(url, url !== root);
        if (humansTxt !== null) {
          break;
        }
      }
    }
    return humansTxt;
  }

  async function fetchTextFile(url, mustBePlainText) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'same-origin',
        credentials: 'same-origin',
        referrerPolicy: 'same-origin'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      // A site that answers every unknown path with a page should not get that page as credits
      if (mustBePlainText && !(response.headers.get('content-type') || '').startsWith('text/plain')) {
        throw new Error('not a text file');
      }
      const data = await response.text();
      if (!data.trim()) {
        throw new Error('empty file');
      }
      return data;
    } catch (err) {
      console.warn(`QreditRoll: could not load ${url} (${err.message})`);
      return null;
    }
  }

  function createIFrame() {
    frame = document.createElement('iframe');
    // Ready when the frame has loaded and the app in it has announced itself; a frame that fails
    // to load is never shown
    frameReady = Promise.all([
      new Promise((resolve) => { frame.onload = resolve; }),
      new Promise((resolve) => { notifyFrameAnnounced = resolve; })
    ]);
    frame.id = 'qreditrollframe';
    frame.title = 'QreditRoll';
    frame.src = `${clientDomain}/qreditroll.html?hostDomain=${encodeURIComponent(window.location.origin)}`
      + (theme ? `&theme=${encodeURIComponent(theme)}` : '')
      + (music ? `&music=${encodeURIComponent(music)}` : '');
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

    if (music) {
      passMusic();
    }
  }

  // The site's own music is fetched here, by the site itself: a file on the site needs no CORS headers
  function passMusic() {
    const target = client;

    fetch(music).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.arrayBuffer();
    }).catch(err => {
      console.warn(`QreditRoll: could not load ${music} (${err.message})`);
      return null;
    }).then(data => frameReady.then(() => {
      // Not to a frame that stop() has taken away in the meantime
      if (target === client) {
        target.postMessage({ type: 'passMusic', music: data }, clientDomain, data ? [data] : []);
      }
    }));
  }

  function addKeyListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        stop();
      } else if (state === 'open' && scrollKeys[e.key] && !(e.altKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!e.repeat) {
          scroll(scrollKeys[e.key]);
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      if (scrollKeys[e.key]) {
        scroll(0);
      }
    });
  }

  function addKonamiListener() {
    const allowedKeys = { 'ArrowLeft': 'left', 'ArrowUp': 'up', 'ArrowRight': 'right', 'ArrowDown': 'down', 'a': 'a', 'b': 'b' };
    const konamiCode = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
    let konamiCodePosition = 0;

    document.addEventListener('keydown', (e) => {
      const key = allowedKeys[e.key];
      const requiredKey = konamiCode[konamiCodePosition];
      if (key == requiredKey) {
        konamiCodePosition++;
        if (konamiCodePosition == konamiCode.length) {
          start();
          konamiCodePosition = 0;
        }
      } else {
        // If wrong key pressed, check if it's the start of a new sequence
        konamiCodePosition = (key == konamiCode[0]) ? 1 : 0;
      }
    });
  }

  // start({ silent: true }) opens this roll without sound, for a page whose own sound is switched off
  function start(options) {
    if (state !== 'idle') {
      return;
    }
    state = 'loading';
    startSilent = !!(options && options.silent);

    if (!frame) {
      createIFrame();
    }

    show();
  }

  async function show() {
    const txt = await fetchHumansTxt();
    if (txt) {
      await frameReady;
    }

    // Stopped while loading, or a later start() already opened the frame
    if (state !== 'loading') {
      return;
    }
    if (!txt) {
      state = 'idle';
      return;
    }
    state = 'open';
    focusBefore = document.activeElement;

    if (!humansTxtPassed) {
      client.postMessage({ type: 'passHumansTxt', humansTxt: txt }, clientDomain);
      humansTxtPassed = true;
    }

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
    // The frame has its full size while the roll loads, but is still invisible: until the roll
    // starts, clicks and touches go through it to the page
    if (frameReportsStart) {
      frame.style.pointerEvents = 'none';
    }

    client.postMessage({ type: 'startQreditRoll', silent: startSilent }, clientDomain);
  }

  // The frame fades out first and then reports back, see hide(). A frame that does not report back
  // is taken away, so the roll closes anyway
  function stop() {
    if (state === 'loading') {
      state = 'idle';
    } else if (state === 'open') {
      client.postMessage({ type: 'stopQreditRoll' }, clientDomain);
      if (!stopTimer) {
        stopTimer = setTimeout(() => hide(true), STOP_WAIT);
      }
    }
  }

  // 1 fast-forwards, -1 rewinds, 0 lets the roll run by itself again
  function scroll(direction) {
    if (state === 'open') {
      client.postMessage({ type: 'scrollQreditRoll', direction }, clientDomain);
    }
  }

  function hide(discardFrame) {
    if (!frame) {
      return;
    }
    clearTimeout(stopTimer);
    stopTimer = null;

    // A click in the roll took the keyboard focus into the frame: the page gets it back
    if (document.activeElement === frame) {
      if (focusBefore) {
        focusBefore.focus({ preventScroll: true });
      }
      // Nothing had the focus, or that element is gone. (Blurring the frame does nothing in Safari.)
      if (document.activeElement === frame) {
        window.focus();
      }
    }

    if (discardFrame) {
      // This frame did not answer: the next start() makes a new one
      frame.remove();
      frame = null;
      client = null;
      humansTxtPassed = false;
    } else {
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
    }
    state = 'idle';

    if (rolling) {
      rolling = false;
      notify('stop');
    }
  }

  init();
  return (window[loadedKey] = { start, stop, scroll });
})();

// For a page that loads this script as a module: the var above is not a property of window there
window.QreditRoll = QreditRoll;
