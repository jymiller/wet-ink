# wet-ink

Hackathon entry for the Last Mile Agent Hackathon (July 21, 2026, SF — doors 5:30 PM,
hacking 6:45–8:00 PM, judging 8:00 PM). Solo builder: John.

**Start by reading `HANDOFF.md` then `GUIDELINES.md` in this directory** (local files,
deliberately not committed). HANDOFF holds the plan of attack: the demo concept, the
interface contract every component must follow, workstreams, timeline with gates, cut lines,
and pointers to the research archive. GUIDELINES holds the how-to-win rules distilled from
the last event's winners (pitch, choreography, cockpit UX, integrations, claims). Do not
begin building or restructuring anything before reading both.

Ground rules:

- Never commit or push without John's explicit confirmation. Verify `git status` shows no
  secrets before any commit. `.env`, `.env.local`, and `HANDOFF.md` stay untracked.
- The honesty labels REAL / PRERUN / SYNTHETIC are load-bearing product UI, not disclaimers.
  Never present a simulated or pre-run step as live.
- The offline deterministic path must keep working at all times — it is the demo's floor.
  Every network dependency needs a labeled fallback.
- Claim discipline: "our authority policy reserves this for a human," never "the law requires."
- Zero npm dependencies in the Node core (chassis is dep-free ESM, Node >= 18). The
  Cloudflare Worker under `worker/` is the only separate runtime.
