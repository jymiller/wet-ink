// The policy Pomerium enforces — PPL in spirit. DENY wins, default-deny.
//
// The AGENT identity may read and compute. State-changing external actions
// (submit / publish / attest / send / delete) are denied to the agent — they
// require an OPERATOR identity carrying a human's attestation. When a human
// attests in the cockpit, the same action runs as "operator" and is allowed.

const DENY_PREFIX = ["serve_", "submit_", "publish_", "attest_", "send_", "pay_", "delete_"];
const ALLOW = [
  "read_",
  "check_",
  "get_",
  "recompute_",
  "hold_",
  "fingerprint_",
  "escalate_",
];

export function decide(sys) {
  const t = sys.tool;
  const human = sys.identity === "operator";
  if (DENY_PREFIX.some((p) => t.startsWith(p))) {
    if (human) return { decision: "ALLOW", reason: "human attestation present (operator)" };
    return { decision: "DENY", reason: `${t} needs a human's attestation the agent doesn't hold` };
  }
  if (ALLOW.some((p) => t === p || t.startsWith(p))) return { decision: "ALLOW", reason: null };
  return { decision: "DENY", reason: `${t} is not in the allow policy (default deny)` };
}
