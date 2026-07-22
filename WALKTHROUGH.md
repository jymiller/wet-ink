# WET INK — demo walkthrough (record this)

**~2 minutes. Two browser tabs, both on `localhost:8080`.**
Keep this open on a second screen. `[DO]` = what to click. `[SAY]` = read it.

## Pre-flight (before you hit record)
1. Server running: `node server.js` (it is — leave it).
2. Tab A → `http://localhost:8080/fleet`  (the book — leave it un-scanned / all dim)
3. Tab B → `http://localhost:8080/`  (the hero cockpit — fresh page, showing the WET INK title)
4. Sound ON (the phone call is real audio).
5. Start on Tab A.

---

## ACT 1 — THE BOOK  (Tab A · /fleet · ~35s)

**[SAY]** "A bank writes a loan, the ink dries, and the loan officer moves on. But the covenant lives for *years* — every quarter a compliance cert comes in, and somebody has to actually read it. **Wet Ink is that watcher.** Here's a book of 100 deals."

**[DO]** Click **▶ SIMULATE SCAN**. Let the grid fill (green = clear, red = breach).

**[SAY]** "It reads every cert as it arrives. Green clears; **red is a covenant breach**. And the second it finds one, it flags it for the desk — the **priority deal escalates by phone** in the cockpit, and the rest wait for an officer to action." *(point at the breaches flagged on the right)*

**[SAY]** "And it stays honest — see the labels: this scan is **SYNTHETIC** so we spend nothing, and nothing's been sent — the breaches are just flagged."

---

## ACT 2 — THE HERO DEAL  (→ Tab B · / · ~45s)

**[DO]** Switch to Tab B (the cockpit). Click **▶ RUN LOOP**.
*(This takes ~25s — real Novita is generating the call. Narrate over it, don't cut.)*

**[SAY]** "Let's open the one that matters — deal NW-1. The agent reads the actual paper cert — **real OCR** — and recomputes coverage. The **dashboard says 1.50, green**. The **paper says 1.33** — below the 1.40 floor. A real breach the dashboard hid on stale numbers."

**[SAY]** *(as the gate denies + the call plays)* "So it tries to serve formal notice — and our **policy gate stops it**. Serving legal notice is reserved for a human. Watch: it picks up the phone and calls the loan officer, **in its own voice** — a real Novita call."

---

## ACT 3 — ATTEST + PROOF  (Tab B · ~30s)

**[DO]** Click **✋ ATTEST & SERVE**.

**[SAY]** "I attest. Now the same action runs under **my** authority — and the notice goes out, a real fax through ActionLayer." *(scroll to the proof panel)*

**[SAY]** "Dashboard said **1.50 green**. Paper said **1.33 breach**. Wet Ink watched the whole book, caught it, reached a human, and served the notice — **every step on the audit trail.**"

---

## CLOSE  (~10s)

**[SAY]** "The borrowers are fictional. The **certs, the OCR, the math, and the call are real**. This is credit operations — covenant monitoring and legal notice. **That's Enid.**"

---

## Honesty one-liner (say it once, early)
> "Borrowers fictional; the certs, OCR, math and phone call are real; the fax is pre-run — and every panel is labeled REAL / PRERUN / SYNTHETIC."

## If something breaks (rehearsed fallbacks, not apologies)
- **Cockpit call slow / silent:** keep narrating the on-screen read; the labels and math carry it.
- **Anything live fails:** the SIMULATE scan and the cockpit both run offline-deterministic — labels stay honest, demo still lands.
- **Page looks stale:** reload the tab; state is server-side.
- **Reset the book between takes:** click **↺ RESET portfolio** on /fleet.

## URLs
- Portfolio watch: `http://localhost:8080/fleet`
- Hero cockpit: `http://localhost:8080/`
- (Design north-star reference, not for the video: `mockups/storyboard.html`)
