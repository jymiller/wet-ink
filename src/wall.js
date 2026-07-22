// CLI renderer — consumes the same event stream the cockpit does.

const e = (n) => `\x1b[${n}m`;
const R = e(0),
  B = e(1),
  amber = e("38;5;179"),
  green = e("38;5;72"),
  red = e("38;5;167"),
  blue = e("38;5;110"),
  mag = e("38;5;175"),
  grey = e("38;5;244");
const pad = (s, n) => ((s = String(s)), s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));

export function cliEmit(ev) {
  if (ev.t === "intro") {
    console.log("");
    console.log(`${B}${amber}WET INK${R}${grey}  ·  loan covenant monitor · deal NW-1${R}`);
    console.log(`${grey}read → recompute → hold → serve   ·   every action passes the policy gate first${R}`);
    console.log(`${grey}live: ${ev.live.length ? green + ev.live.join(", ") + R + grey : "none (offline floor)"}${R}\n`);
    return;
  }
  if (ev.t === "cycle") {
    const deny = ev.decision === "DENY";
    const gc = deny ? red : green;
    console.log(`${B}◆ CYCLE ${ev.n}${R}  ${grey}·  budget $${ev.budget.toFixed(3)}  ·  ${ev.live ? "live" : "offline"}${ev.human ? "  ·  operator" : ""}${R}`);
    console.log(`  ${blue}PLAN   ${R} ${pad(ev.tool, 22)} ${grey}${(ev.rationale || "").slice(0, 46)}${R}`);
    console.log(`  ${blue}GATE   ${R} ${pad(ev.tool, 22)} ${gc}${B}${ev.decision} ${ev.status}${R}${deny ? `  ${grey}${ev.reason}${R}` : ""}`);
    console.log(`  ${amber}OBSERVE${R} ${deny ? red + ev.observe + R : ev.observe}`);
    console.log(`  ${mag}CORRECT${R} ${grey}${ev.correct}${R}\n`);
    return;
  }
  if (ev.t === "await") {
    console.log(`${B}${amber}⏸  AWAITING HUMAN ATTESTATION${R}  ${grey}— ${ev.reason}${R}\n`);
    return;
  }
  if (ev.t === "receipt") {
    console.log(`${B}${ev.status === "clear" ? green + "✔ CLEAR — no covenant breach, no action taken" : ev.submitted ? green + "✔ SERVED — human attestation recorded" : amber + "╔══ HELD — awaiting human attestation ══╗"}${R}`);
    for (const l of ev.lines) console.log(`  ${l.ok ? green + "✓" : red + "!"}${R} ${l.text}   ${grey}· ${l.sponsor}${R}`);
    console.log(`\n${B}The agent's limits live somewhere it can't reach.${R}\n`);
    return;
  }
}
