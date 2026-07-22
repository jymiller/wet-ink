# Smoke results — Novita, July 21 ~01:45 AM

Key valid; base URL https://api.novita.ai/openai/v1 (OpenAI-compatible). 140 models visible.

## Chat (kernel planning) — PASS, with required config
- Model: deepseek/deepseek-v4-flash (NOVITA_MODEL).
- It is a reasoning model: with small max_tokens it burns the whole budget on
  reasoning and returns EMPTY text. Required: `"chat_template_kwargs": {"thinking": false}`.
  With that flag: clean one-clause replies, ~1-2s.
- src/novita.js must repoint base URL AND pass the flag (workstream D).

## OCR (deepseek/deepseek-ocr-2) — PASS, with required config
- Prompts: ONLY canonical forms work. "Free OCR." (plain text, keeps fax header +
  note markers) or "Convert the document to markdown." Freeform instructions
  return canned junk.
- `"temperature": 0, "top_p": 1` is MANDATORY. At default temperature the model
  silently hallucinated plausible financials on an identical image (525/158
  instead of 285/214) roughly 1-in-2 runs. At temp 0: byte-stable across 3 runs,
  all values correct on A and D variants, ~5s per page.
- Guard for live runs: verify the statement's internal arithmetic after OCR
  (gross = rev − cost; ebitda = gross − opex; op = ebitda − D&A; pretax = op − interest).
  The hallucinated run fails this check; a correct read passes. Re-OCR on failure.

## Pipeline end-to-end — PASS
render (fixtures/NW1-*.html) → PNG → OCR → LLM semantic diff (temp 0, thinking off,
json_object) → local arithmetic:
- NW1-R3-A: found 'Adjusted EBITDA'=285 / 'Net interest expense'=214, renamed=true
  → 1.33 vs 1.40 → BREACH. Matches expected.json.
- NW1-R3-D (decoy): 334/216 → 1.55 → clear. Matches. No false positive on rename.

## ActionLayer — smoked ~08:14-08:31 AM, MIXED
- Key valid, /v1/me 200. Browser task (read-only FaxZero recon) succeeded.
- LATENCY: ~17 min end-to-end for a trivial task, queue-dominated (13+ min in
  `pending` before any progress). Implication: a live ticket CANNOT be fired
  mid-demo and waited on. Either pre-create before judging and resume after
  attestation (confirmation may still land after the slot; show in Q&A), or
  lean on the PRERUN artifact.
- BALANCE: tasks_remaining went 1 -> 0 after the test; plan=free; the
  "tasks_purchased: 50" field did NOT decrement (appears to be a lifetime
  counter, not an available pool). As of 08:35 the account has ZERO usable
  tasks; cycle resets Aug 21. Live fax via ActionLayer is blocked until John
  buys tasks / redeems event credits (plan had "swap in any event credits" at
  the 18:00 workshops) / dashboard says otherwise.
- FaxZero form intel (from the recon): sender name + email (phone optional);
  recipient name + fax number (company optional); optional cover text; upload
  .doc/.docx/.pdf via file picker. Recon did not confirm or rule out a CAPTCHA.

## Not yet smoked
- Twilio decision (creds are in .env) — deep-research on alternatives in flight.

## BUILT — linear Wet Ink spine, ~15:20, VERIFIED end-to-end (live OCR)
Freeze extended to 16:30 by John. New/changed files:
- src/ocr.js       — Novita OCR + semantic diff + arithmetic guard; hard offline
                     fallback to fixtures/expected.json. Guard compares magnitudes
                     (parens = negative) — REAL reads pass, hallucinations fall back.
- src/fax.js       — serve delivery: SYNTHETIC mock (default) / PRERUN (FAX_PRERUN_REF)
                     / REAL ActionLayer seam (commented, dark until account has tasks).
- src/voice.js     — escalation call: composes the line from live run numbers, Novita
                     MiniMax TTS (POST /v3/minimax-speech-02-turbo, voice English_expressive_
                     narrator; response .audio is hex mp3) -> public/escalation.mp3. No key /
                     net -> mode SKIP (transcript-only card). Verified plays in-browser (20s).
- src/tools.js     — loan toolbox: read_statement, recompute_ratio, hold_determination,
                     serve_notice, escalate_to_human. Every observation labeled REAL/SYNTHETIC.
- src/kernel.js    — loan task queue read->recompute->hold->serve; emits gauge data on
                     recompute; rails gate/audit/novita/actionlayer. run()/attest() unchanged shape.
- src/policy.js    — DENY now includes serve_ and pay_; ALLOW includes hold_.
- public/cockpit.html, src/wall.js, server.js — reskinned COLD OPEN -> WET INK.
Verified: RUN -> read REAL 285/214 -> recompute 1.33 BREACH -> hold -> serve DENY 403
(agent) -> [live TTS escalation call plays] -> ATTEST -> serve ALLOW 200 (operator) -> SERVED.
audit.jsonl shows deny-then-allow. Decoy variant D reads REAL and stays clear (1.55).
Offline floor verified: no key -> SYNTHETIC read + SKIP voice + mock serve, still SERVED.
Browser-verified: cockpit renders all cycles, gauge, escalation audio card (plays 20s).
Decoy path FIXED: clean statement (variant D) halts at hold_determination -> receipt
status "clear" (green), no escalation, no false serve. Verified live (334/216 -> 1.55 clear)
and offline. Three receipt states now: clear | held | served (kernel + cockpit + wall).
Pre-run fax notice: fixtures/notice.html -> props/NW1-notice.pdf (Harbourline -> Northwind,
1.33 breach, J. Miller sig, dark DEMONSTRATION/FICTIONAL footer that survives B&W fax).
Serve shows PRERUN once FAX_PRERUN_REF is set in .env (after John hand-sends one FaxZero fax).

## GUIDELINES §3 cockpit pass — DONE ~16:00, browser-verified (breach + decoy)
Built into public/cockpit.html per GUIDELINES.md (which I'd missed until John flagged it):
- Wordmark title card + retellable reframe ("did the lender get legally noticed?") on boot.
- Pinned scoreboard strip: pages read · coverage 1.33×/1.40× · agent attempts denied ·
  artifacts produced · elapsed (live end-to-end clock, RUN→SERVED incl. human time).
- Narrating mono-caps section headers (A LIVE LOAN FILE / THE GATE / THE PROOF).
- First-person sticky state banner ("I'm holding the determination for your signature").
- Persistent REAL(green)/PRERUN(amber)/SYNTHETIC(blue) legend, lit by run mode; inline
  observe tokens color-coded to match. WHY column on every cycle row.
- NEEDS YOU escalation card with pass chips: numbers ✓ · threshold ✓ · authority ✕ DENIED.
- Close PROOF panel: giant delta DASHBOARD 1.50× GREEN vs PAPER 1.33× BREACH + artifact/
  denied/elapsed footer. Decoy variant shows 1.48× vs 1.55×, both green (clear styling).
Skipped (deferred): replay scrubber. Pre-run fax notice PDF ready (props/NW1-notice.pdf).
Not yet done: FAX_PRERUN_REF wiring (awaits John's hand-sent FaxZero + confirmation).

## DEMO OPERATOR NOTES
- Start: `set -a; . ./.env; set +a; node server.js` -> http://localhost:8080. RUN, then ATTEST.
- RESTART the server before the real demo to zero the in-memory audit count (rm -f audit.jsonl).
- Variant: env DEMO_VARIANT=A|B|C|D (A default = the Adjusted-EBITDA rename, 1.33).
- Live OCR needs Novita reachable; if the net drops it auto-falls-back to SYNTHETIC (labeled).
- The served fax is a MOCK (SYNTHETIC). To make the channel real, hand-send one FaxZero
  fax this morning and set FAX_PRERUN_REF=<confirmation> -> serve step labels PRERUN.

## RESUME STATE — paused ~08:35 AM for a ~4h token pause
- READY: OCR pipeline proven end-to-end (breach 1.33 on A, clean 1.55 on decoy D);
  fixtures/generate.js + expected.json; props/NW1-{A,B,C,D}.pdf print-ready for FedEx.
- BLOCKED: ActionLayer shows 0 usable tasks (see section above). John must buy
  tasks, or redeem event credits at the 18:00 workshops, before ANY live or
  prerun fax works. Honest fallback: hand-send one FaxZero PRERUN artifact; run
  the 20:00 serve step against workstream D's mock with a SYNTHETIC label.
- NOT STARTED: build workstreams A (judge cockpit Worker), B (webcam + live-OCR
  wiring; core already proven), C (voice rail), D (kernel rewrite to loan tools +
  mock fax client). John is holding for a scope talk before launch. Note: QR
  cards need the Worker URL to exist before they can be printed.
- IN FLIGHT: deep-research on no-preamble Twilio alternatives — will deliver one
  report; result feeds the voice/telephony decision.
- CLOCK: 15:00 freeze. Roughly 6-7h of build runway when John returns.

Print-ready PDFs for the FedEx run: props/NW1-{A,B,C,D}.pdf (gitignored).
