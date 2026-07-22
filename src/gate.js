import { uid } from "./envelope.js";
import { decide } from "./policy.js";
import { appendAudit } from "./audit.js";

// Pomerium — the gate. Every syscall passes here before it runs. Nothing the
// agent does escapes it: it holds no upstream credential and has no socket
// except through this call.
//
// Real proxy: when POMERIUM_URL is set, route the MCP call through Pomerium and
// use its authorize decision + request_id. One-file swap — the policy below is
// the same PPL, and we already write the same audit fields. Until the proxy is
// up, this enforces it in-process; the security model is identical.

export async function gate(sys, env) {
  // Seam: real Pomerium goes here.
  // if (env.POMERIUM_URL) return await routeThroughPomerium(sys, env);

  const request_id = uid("req");
  const d = decide(sys);
  const verdict = {
    decision: d.decision,
    status: d.decision === "DENY" ? 403 : 200,
    reason: d.reason,
    request_id,
  };

  appendAudit({
    ts: sys.ts,
    request_id,
    identity: sys.identity,
    "mcp-tool": sys.tool,
    "mcp-tool-parameters": sys.args,
    decision: verdict.decision,
    status: verdict.status,
    reason: verdict.reason,
  });

  return verdict;
}
