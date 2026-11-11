# QreditRoll - an epic credit roll for websites

Hello website creator!

Is your work at least as cool as a movie?
Of course it is!

Are you proud of your work?
Of course you are!

Well, your work should carry your name then. You and your team should get your own epic credit roll! You deserve it! Your hard work demands it!

Make it epic, use QreditRoll.

## Can I see a demo?
Yes, you can! Check it out: https://qreditroll.com/

## How do I implement this?
Include the QreditRoll script at the end of the `body` element of your website. (Make sure to use https.)

`<script src="https://qreditroll.com/qreditroll.js"></script>`

If your website has a Content-Security-Policy, make sure to add `qreditroll.com` to the allowed origins. QreditRoll uses an iframe to show the credits, so you will need to add a frame segment as well. Your Content-Security-Policy might look like this:
`default-src 'self'; connect-src 'self' qreditroll.com; script-src 'self' qreditroll.com; frame-src qreditroll.com;`

Make sure you have a `humans.txt` file, like explained on http://humanstxt.org/. QreditRoll will display your `humans.txt` in awesome credit roll fashion, with epic background music.

The credit roll is triggered by the Konami code or if you call `QreditRoll.start();` yourself, on a button click for example. If you choose to only use the Konami code, you might want to drop a hint in your source code.

Visitors fast-forward and rewind with the mouse wheel, a finger or the arrow keys, and close the roll with the X or Escape. Visitors who prefer reduced motion (`prefers-reduced-motion`) get credits that stand still: they scroll through them themselves.

## Where does it look for humans.txt?
If your page has a `<link rel="author" href="...">` that points to a text file on your own site, QreditRoll uses that file. Without such a link it uses `/humans.txt` at the root of your site.

## Can I make it my own?
Yes, with options on the script tag. Leave them out and QreditRoll is its good old self. See them all at work on https://qreditroll.com/example/.

```html
<script src="https://qreditroll.com/qreditroll.js"
        data-theme="credits.css"
        data-music="credits.mp3"
        data-konami="off"></script>
```

| Option | What it does |
| --- | --- |
| `data-theme` | Your own stylesheet. It is loaded after QreditRoll's own [style.css](style.css), so it only needs what you want different: `body` for text and font, `body.active` for the backdrop, `body.scrolling` for the fast-forward look, `h2`, `p`, `#close`. |
| `data-music` | Your own music instead of the Funny Song. It speeds up and rewinds just the same. The line "Music: Funny Song" only shows when that song plays, so credit your music in your `humans.txt`. |
| `data-konami="off"` | No Konami code. Open the roll yourself with `QreditRoll.start()`. |

Good to know:
- The stylesheet is loaded by the QreditRoll frame, not by your page. It has to be reachable without logging in, and fonts from your own server need an `Access-Control-Allow-Origin` header.
- The music is fetched by your own page, so a file on your own site just works. A file on another origin needs CORS headers there (`Access-Control-Allow-Origin`), and with a Content-Security-Policy on your site `connect-src` has to allow it. The music plays once and does not loop.
- A stylesheet or music that takes longer than 8 seconds is skipped for that roll: it starts with the standard look, or without sound.
- If you add the script later, from your own code, set the options on `script.dataset` before you append it.

## Can my page control the roll?
Yes. That is how you hook up a game controller, for example.

| Call | What it does |
| --- | --- |
| `QreditRoll.start()` | Opens the roll. |
| `QreditRoll.stop()` | Closes the roll. |
| `QreditRoll.scroll(direction)` | `1` fast-forwards, `-1` rewinds, `0` lets the roll run by itself again. It keeps going until you call it again. |

QreditRoll tells your page what happens with events on `document`:

| Event | When |
| --- | --- |
| `qreditroll:start` | The roll starts rolling. |
| `qreditroll:stop` | The roll has closed, by itself at the end or because someone closed it. |
| `qreditroll:silent` | Right after `qreditroll:start`, if this roll has no sound: the browser blocked it, or the music could not be loaded. |

```js
document.addEventListener('qreditroll:start', () => myMusic.pause());
document.addEventListener('qreditroll:silent', () => myMusic.play());
document.addEventListener('qreditroll:stop', () => myMusic.play());
```

## How do I run this myself?
It's all static files, so just spin up a simple webserver, like `python -m SimpleHTTPServer 8000`, and go to http://localhost:8000/.
