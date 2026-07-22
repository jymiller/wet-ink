import { makeSyscall } from "./envelope.js";
import { gate } from "./gate.js";
import { think } from "./novita.js";
import { act } from "./tools.js";
import { auditCount } from "./audit.js";
import { synthEscalation } from "./voice.js";

const START_BUDGET = 100;

// Which real rails light up per tool. Every gated + logged action touches the gate
// and the audit trail; OCR is Novita; delivery is ActionLayer.
const RAIL_OF = {
  read_statement: ["novita"],
  serve_notice: ["actionlayer"],
};

function freshState() {
  return { spend: 0, reading: null, example: null, held: false, served: null, submitted: false };
}

function cycleEvent(n, sys, live, budget, sponsors, human = false) {
  const v = sys.verdict;
  const o = sys.observation;
  const deny = v.decision === "DENY";
  return {
    t: "cycle",
    n,
    human,
    tool: sys.tool,
    identity: sys.identity,
    rationale: sys.rationale,
    decision: v.decision,
    status: v.status,
    reason: v.reason,
    observe: deny ? `eperm: ${sys.tool} denied` : o.summary,
    correct: deny ? "escalate — a human must attest" : o.halt ? "halt" : "queue next",
    example: sys.tool === "recompute_ratio" && !deny ? o.data : null,
    budget,
    live,
    sponsors,
  };
}

function receiptEvent(state) {
  const r = state.reading;
  const clear = !r || !r.breach;
  const lines = [];
  if (r)
    lines.push({ ok: true, sponsor: "novita", text: `statement read ${r.mode} — ${r.label_e} ${r.ebitda} / ${r.label_i} ${r.interest}` });
  if (r)
    lines.push({ ok: clear, sponsor: "recompute", text: `${r.deal} ICR ${r.corrected}x ${r.breach ? "BREACH" : "clear"} (dashboard showed ${r.naive}x — stale)` });
  if (clear) {
    lines.push({ ok: true, sponsor: "gate", text: "no covenant action — agent stood down, nothing to declare" });
    lines.push({ ok: true, sponsor: "audit", text: `${auditCount()} actions authorized before they ran (audit.jsonl)` });
    return { t: "receipt", status: "clear", submitted: false, lines };
  }
  lines.push({ ok: true, sponsor: "gate", text: state.served ? "serve_notice denied to agent; ran under operator attestation" : "serve_notice denied to agent — awaiting attestation" });
  lines.push({ ok: true, sponsor: "audit", text: `${auditCount()} actions authorized before they ran (audit.jsonl)` });
  lines.push({ ok: true, sponsor: "actionlayer", text: state.served ? `notice served ${state.served.mode} via ${state.served.channel}` : "notice held — not yet served" });
  return { t: "receipt", status: state.served ? "served" : "held", submitted: !!state.served, lines };
}

// Run autonomously until the agent hits an action it can't take alone: serving notice.
export async function run(env, emit) {
  const state = freshState();
  const queue = [
    { id: "t1", goal: "Read the borrower's restated statement", tool: "read_statement", args: { variant: env.DEMO_VARIANT || "A" } },
    { id: "t2", goal: "Recompute the interest-coverage ratio", tool: "recompute_ratio", args: {} },
    { id: "t3", goal: "Hold the determination", tool: "hold_determination", args: {} },
    { id: "t4", goal: "Serve formal notice of breach", tool: "serve_notice", args: {} },
  ];

  const live = [];
  if (env.NOVITA_API_KEY) live.push("Novita");
  if (env.ACTIONLAYER_LIVE_FAX) live.push("ActionLayer");
  emit({ t: "intro", live });

  let cycle = 0;
  while (queue.length) {
    const task = queue.shift();
    cycle += 1;
    const th = await think(`Task: ${task.goal}. In one terse clause, why is "${task.tool}" the next move?`, env);
    state.spend += th.cost;
    const sys = makeSyscall(task, th.text || task.goal, "agent");
    sys.verdict = await gate(sys, env);
    const sponsors = ["gate", "audit", ...(RAIL_OF[task.tool] || [])];

    if (sys.verdict.decision === "DENY") {
      sys.observation = { kind: "eperm", denied_tool: sys.tool, reason: sys.verdict.reason };
      emit(cycleEvent(cycle, sys, th.live, START_BUDGET - state.spend, sponsors));
      const voice = await synthEscalation(state.reading, env);
      state.voice = voice;
      emit({ t: "await", tool: sys.tool, reason: sys.verdict.reason, audio: voice });
      return { state, pending: task, cycle };
    }
    sys.observation = await act(sys, env, state);
    emit(cycleEvent(cycle, sys, th.live, START_BUDGET - state.spend, sponsors));
    if (sys.observation.halt) break;
  }
  emit(receiptEvent(state));
  return { state, done: true };
}

// The human (loan officer) attests: re-run serve_notice as "operator". Same gate, allowed.
export async function attest(env, ctx, emit) {
  const { state, pending, cycle } = ctx;
  const th = await think(`A human loan officer attests: ${pending.goal}.`, env);
  state.spend += th.cost;
  const sys = makeSyscall(pending, "human loan officer attests — this identity carries the authority the agent lacked", "operator");
  sys.verdict = await gate(sys, env);
  if (sys.verdict.decision === "ALLOW") {
    sys.observation = await act(sys, env, state);
  } else {
    sys.observation = { kind: "eperm", denied_tool: sys.tool, reason: sys.verdict.reason };
  }
  const sponsors = ["gate", "audit", ...(RAIL_OF[pending.tool] || [])];
  emit(cycleEvent(cycle + 1, sys, th.live, START_BUDGET - state.spend, sponsors, true));
  emit(receiptEvent(state));
  return { state, done: true };
}
