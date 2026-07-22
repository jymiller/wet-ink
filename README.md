# Wet Ink

**Covenant monitoring & legal notice for credit teams.**
Not *"can the model read the PDF?"* — *"did anyone catch the breach, and get the lender legally noticed?"*

Built for the Last Mile Agent Hackathon (July 21, 2026, SF). A working demo of [Enid](https://enidpa.com).

---

## The premise

A bank signs a loan, the ink dries, and the loan officer moves on to the next deal. But the covenant lives for *years* — every quarter a compliance certificate arrives, and somebody has to actually read it, recompute the ratios, and act if the borrower has slipped. Mostly, nobody does. The dashboard stays green on stale numbers, and a real breach goes unnoticed until it's expensive.

**Wet Ink is the watcher that stays on the whole book.** It reads every cert as it comes in, catches the breaches the dashboard hides, and — because serving legal notice is not a machine's call — reaches a human to sign off before anything goes out.

## What it does

- **Watches the portfolio.** 100 deals under continuous covenant watch; each incoming cert is read and scored (`/fleet`).
- **Reads the paper.** OCR pulls the numbers off the actual cert — including restated line items the lender's baseline doesn't expect — and recomputes coverage. In the demo, the cert says **1.33×** against a **1.40×** floor while the dashboard still shows a green **1.50×** on pre-restatement earnings.
- **Holds the line on authority.** The agent can *flag* a breach, but a policy gate **denies** it the ability to serve formal notice. It holds the determination and escalates.
- **Reaches a human, on the right channel.** A phone call in the agent's own voice for the priority deal; SMS and WhatsApp for the rest of the book.
- **Serves the notice — after a signature.** Once a human attests, the same action runs under *their* identity and the formal notice goes out a real-world channel.
- **Proves it.** Every action lands on a hash-chained audit trail, and every panel is labeled **REAL / PRERUN / SYNTHETIC**.

## The demo (≈2 min)

1. **The book** (`/fleet`) — hit *Simulate Scan*; the grid fills, breaches turn red, each routed to a human by channel.
2. **The hero deal** (`/`) — *Run Loop*: real OCR reads the cert, recomputes **1.33×**, the gate **denies** `serve_notice`, and the agent phones the loan officer.
3. **Attest & serve** — a human signs off; the notice is served and the proof panel shows **dashboard 1.50× green vs. paper 1.33× breach**.

## Honesty is a feature, not a disclaimer

The borrowers are fictional. The certs, the OCR, the math, and the phone call are real. Anything captured ahead of time is labeled **PRERUN**; a simulated portfolio scan is **SYNTHETIC**; live rails are **REAL**. We never claim "the law requires" — it's **"our authority policy reserves this for a human."** The agent's limits are inspectable: it is *denied*, it *escalates*, and the privileged action only ever runs under a human's identity.

## Integrations (both load-bearing)

- **Novita** — DeepSeek-OCR reads the compliance certs; a reasoning model drives the agent loop and the semantic diff between cert and covenant (no hardcoded string matching); Novita TTS generates the escalation call live, in the agent's own voice, from real run data.
- **ActionLayer** — the real-world execution rail that finishes the job off-screen: serving the formal breach notice through a third party, and delivering the SMS / WhatsApp escalations that reach the responsible human.

## Run it

Node ≥ 18, zero npm dependencies in the core.

```
node server.js
```

- `http://localhost:8080/`       — the hero cockpit (single deal)
- `http://localhost:8080/fleet`  — portfolio watch (the whole book)

Runs **offline-deterministic with zero keys** — that's the demo's floor, and every live rail has a labeled fallback. Live mode reads `NOVITA_API_KEY` / `ACTIONLAYER_API_KEY` from `.env` (see `.env.example`).

## About

Wet Ink is a working slice of **[Enid](https://enidpa.com)** — the attestation gate, the determination file, and the evidence bundle *are* the product. Detection isn't done until the notice is served, and serving it is a decision a human owns.
