// The single-deal HERO read: a cheap Novita VLM looks at a restated statement
// image and reports its DSCR (debt service coverage ratio). If there's no key,
// no network, or the model returns junk, we fall back to a SYNTHETIC read so the
// demo floor never drops. Never throws — the caller always gets a labeled number.

import { readFileSync } from "node:fs";

const BASE = "https://api.novita.ai/openai/v1/chat/completions";
const DEFAULT_MODEL = "baidu/ernie-4.5-vl-28b-a3b";
const round2 = (n) => Math.round(n * 100) / 100;

const mime = (p) =>
  /\.jpe?g$/i.test(p) ? "image/jpeg" : /\.webp$/i.test(p) ? "image/webp" : "image/png";

// Pull a dscr number out of whatever the model returned: strict JSON first,
// then a fenced-JSON strip, then a bare-number salvage.
function parseDSCR(raw) {
  const clean = String(raw).replace(/^```json\s*|^```\s*|\s*```$/g, "").trim();
  try {
    const n = Number(JSON.parse(clean).dscr);
    if (Number.isFinite(n)) return n;
  } catch {
    /* fall through to regex salvage */
  }
  const m = clean.match(/"?dscr"?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i) || clean.match(/(-?\d+\.\d+)/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

const changedFrom = (dscr, baseline) =>
  baseline != null && Number.isFinite(baseline) && Math.abs(dscr - baseline) > 0.01;

function synthetic(opts, note) {
  const dscr = round2(opts.expected ?? 1.18);
  return { dscr, changed: changedFrom(dscr, opts.baseline), mode: "SYNTHETIC", note };
}

// Read the DSCR off an image at imagePath. opts: { baseline?, expected? }.
export async function readDSCR(imagePath, env, opts = {}) {
  if (!env?.NOVITA_API_KEY) {
    return synthetic(opts, "no NOVITA_API_KEY — deterministic fallback");
  }
  const model = env.VISION_MODEL || DEFAULT_MODEL;
  try {
    const b64 = readFileSync(imagePath).toString("base64");
    const r = await fetch(BASE, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.NOVITA_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mime(imagePath)};base64,${b64}` } },
              {
                type: "text",
                text:
                  'What is the DSCR (debt service coverage ratio) on this statement? ' +
                  'Reply ONLY JSON {"dscr":number}',
              },
            ],
          },
        ],
      }),
    });
    if (!r.ok) throw new Error(`Novita ${r.status}`);
    const j = await r.json();
    const dscr = parseDSCR(j.choices?.[0]?.message?.content ?? "");
    if (!Number.isFinite(dscr)) throw new Error("no dscr in reply");
    return {
      dscr: round2(dscr),
      changed: changedFrom(dscr, opts.baseline),
      mode: "REAL",
      note: `read live via Novita ${model}`,
    };
  } catch (e) {
    return synthetic(opts, `live read failed (${String(e.message || e).slice(0, 40)}) — deterministic`);
  }
}
