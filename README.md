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

## How do I run this myself?
It's all static files, so just spin up a simple webserver, like `python -m SimpleHTTPServer 8000`, and go to http://localhost:8000/.
