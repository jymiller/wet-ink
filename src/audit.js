import { appendFileSync } from "node:fs";

// The audit trail — the fields Pomerium's authorize log records, written for
// every decision. Append-only, so the record can't be edited after the fact.

const AUDIT = new URL("../audit.jsonl", import.meta.url);
const mem = [];

export function appendAudit(record) {
  mem.push(record);
  try {
    appendFileSync(AUDIT, JSON.stringify(record) + "\n");
  } catch {
    /* read-only fs — keep the in-memory trail */
  }
}

export function auditCount() {
  return mem.length;
}
