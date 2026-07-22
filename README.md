# wet-ink

An agent that finds a hidden covenant breach in a borrower's restated financials,
is structurally denied from declaring it, escalates to the one human who holds
that authority, and — after a signature — serves formal notice down a real-world
channel. Built for the Last Mile Agent Hackathon (July 21, 2026, SF).

The last mile of a 20-year loan is a human signature and a paper channel.
Detection isn't done until notice is served.

Runs offline with zero keys (deterministic fallback). Live mode uses Novita
(reasoning, OCR, voice) and ActionLayer (real-world execution).

```
node server.js    # cockpit at :8080
node index.js     # same loop in the terminal
```
