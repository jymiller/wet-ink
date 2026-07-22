// Serve formal notice down a real-world channel.
//   ACTIONLAYER_LIVE_FAX on  -> the agent fires a real FaxZero send via ActionLayer
//     (browser-driven, cover-page text, no file). Returns REAL with the live ticket id.
//   FAX_PRERUN_REF set        -> PRERUN artifact (a fax hand-sent earlier).
//   otherwise                 -> SYNTHETIC mock.
// Any failure in the live path falls through to the labeled fallbacks, so the
// offline floor never drops.

import { uid } from "./envelope.js";

const AL_BASE = (env) => env.ACTIONLAYER_API_URL || "https://api.actionlayer.io";
const faxDest = (env) => env.FAX_TO || "(844) 735-6723"; // demo destination (FaxBurner)

function noticeText(r) {
  return [
    "NOTICE OF COVENANT BREACH - Deal NW-1.",
    `Per the Credit Agreement the Interest Coverage Ratio (Adjusted EBITDA to Net Interest Expense) must remain at least ${r.threshold}x.`,
    `Based on the restated quarterly statement (${r.label_e} ${r.ebitda} / ${r.label_i} ${r.interest}) the ratio is ${r.corrected}x - a breach.`,
    "Issued under the Agent's authority following officer attestation.",
    "DEMONSTRATION - Last Mile Agent Hackathon. Entities and figures are fictional; no legal notice is created hereby.",
  ].join(" ");
}

async function fireActionLayerFax(r, env) {
  const dest = faxDest(env);
  const instruction =
    `Send a fax using the form on this page. ` +
    `Sender Name: ${env.FAX_SENDER_NAME || "John Miller"}. ` +
    `Sender Company: ${env.FAX_SENDER_COMPANY || "Harbourline Credit Partners"}. ` +
    `Sender Email: ${env.FAX_SENDER_EMAIL}. Sender Phone: ${env.FAX_SENDER_PHONE || "415-555-0100"}. ` +
    `Recipient Name: Corporate Controller. Recipient Company: Northwind Provisions LLC. ` +
    `Recipient Fax Number: ${dest}. ` +
    `Do NOT attach any file. In the cover-page text field type exactly this notice: "${noticeText(r)}". ` +
    `If an anti-bot confirmation code is shown, read it and type it into the confirmation code field. ` +
    `Then click the button to send the free fax. If FaxZero asks you to confirm by email or shows any ` +
    `verification step, complete whatever you can on the page and report exactly what it asks for. ` +
    `Report the final confirmation message.`;

  const res = await fetch(`${AL_BASE(env)}/v1/actions/direct.browser_action`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.ACTIONLAYER_API_KEY}` },
    body: JSON.stringify({ inputs: { url: "https://faxzero.com", instruction } }),
  });
  if (!res.ok) throw new Error(`ActionLayer ${res.status}`);
  const j = await res.json();
  return { ticket: j.payload?.ticket_id || null, outcome: j.outcome, dest };
}

export async function serveNotice(reading, env) {
  const to = `Northwind Provisions LLC ${faxDest(env)}`;
  const subject = `NOTICE OF COVENANT BREACH - ${reading.deal} - ICR ${reading.corrected}x < ${reading.threshold}x floor`;

  if (env.ACTIONLAYER_LIVE_FAX && env.ACTIONLAYER_API_KEY && env.FAX_SENDER_EMAIL) {
    try {
      const { ticket, outcome } = await fireActionLayerFax(reading, env);
      return { mode: "REAL", to, channel: "FaxZero via ActionLayer", ref: ticket, outcome, pending: true, subject };
    } catch {
      /* fall through to a labeled fallback - the floor holds */
    }
  }

  if (env.FAX_PRERUN_REF) {
    return { mode: "PRERUN", to, channel: "FaxZero (sent this morning)", ref: env.FAX_PRERUN_REF, subject };
  }
  return { mode: "SYNTHETIC", to, channel: "FaxZero (mock)", ref: uid("mockfax"), subject };
}
