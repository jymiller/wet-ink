// The one envelope. Every action that crosses a boundary is a Syscall.
// The agent authors tool/args/rationale. Only the gate may author the verdict.
// identity is the principal Pomerium authorizes against ("agent" or "operator").

let _seq = 0;
export function uid(prefix = "id") {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function makeSyscall(task, rationale, identity = "agent") {
  return {
    id: uid("act"),
    task_id: task.id,
    parent_id: task.parent ?? null,
    ts: nowISO(),
    identity,
    tool: task.tool,
    args: task.args ?? {},
    rationale,
    verdict: null,
    observation: null,
    cost: null,
  };
}
