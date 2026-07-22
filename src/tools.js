import { readStatement } from "./ocr.js";
import { serveNotice } from "./fax.js";

// The loan story's toolbox. read/recompute/hold are the agent's to run; serve_
// is denied to the agent by policy and only runs once a human has attested.
// Every observation carries a load-bearing honesty label: REAL | SYNTHETIC | PRERUN.

export async function act(sys, env, state) {
  switch (sys.tool) {
    case "read_statement": {
      const variant = sys.args.variant || "A";
      const r = await readStatement(variant, env, { offline: !!sys.args.offline });
      state.reading = r;
      return {
        kind: "result",
        label: r.mode,
        summary: `[${r.mode}] read ${r.serial}: ${r.label_e} ${r.ebitda} / ${r.label_i} ${r.interest}` +
          (r.renamed ? "  (line renamed vs. lender baseline)" : ""),
        data: r,
      };
    }

    case "recompute_ratio": {
      const r = state.reading;
      if (!r) return { kind: "empty", summary: "no statement read yet" };
      const ex = {
        baseline: r.baseline_ratio, naive: r.naive, corrected: r.corrected,
        threshold: r.threshold, breach: r.breach,
      };
      state.example = { ...ex, ...r };
      return {
        kind: "result",
        label: r.mode,
        summary: `ICR ${r.corrected}x vs floor ${r.threshold} -> ${r.breach ? "BREACH" : "clear"}` +
          `  (dashboard showed ${r.naive}x on stale earnings)`,
        data: ex,
      };
    }

    case "hold_determination": {
      const r = state.reading;
      state.held = !!r?.breach;
      // A clean statement ends here, green — the agent stands down instead of
      // escalating. Only a real breach proceeds to the denied serve_notice.
      return {
        kind: "result",
        label: r?.mode || "SYNTHETIC",
        summary: r?.breach
          ? `determination held: ${r.deal} covenant breach — reserved for a human to declare`
          : `no breach: ${r?.corrected}x clears the ${r?.threshold} floor — agent stands down`,
        data: { breach: !!r?.breach },
        halt: !r?.breach,
      };
    }

    case "serve_notice": {
      // Only reached under an operator identity — the gate denies the agent.
      const r = state.reading;
      if (!r?.breach) return { kind: "result", label: r?.mode || "SYNTHETIC", summary: "no breach to serve", data: {} };
      const s = await serveNotice(r, env);
      state.served = s;
      return {
        kind: "result",
        label: s.mode,
        summary: s.pending
          ? `[${s.mode}] notice SERVING via ${s.channel} — ticket ${s.ref} (confirms shortly)`
          : `[${s.mode}] notice served to ${s.to} via ${s.channel}` + (s.ref ? ` (${s.ref})` : ""),
        data: s,
      };
    }

    case "escalate_to_human":
      state.escalated = true;
      return { kind: "result", label: "REAL", summary: "escalated to the loan officer for attestation", halt: true };

    default:
      return { kind: "empty", summary: `no-op ${sys.tool}` };
  }
}
