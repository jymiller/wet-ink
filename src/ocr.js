// Read a restated statement: Novita DeepSeek-OCR turns the page into text, a
// language model finds the successor of each covenant line BY MEANING (no string
// matching), and an arithmetic guard rejects OCR hallucination. If the live path
// fails for any reason — no key, no network, guard tripped — we fall back to the
// deterministic ground truth so the demo floor never drops.
//
// Smoke-proven config (fixtures/SMOKE.md): OCR needs temperature 0 or it invents
// plausible numbers; the diff model needs thinking:false or it returns empty.

import { readFileSync } from "node:fs";

const OCR_MODEL = "deepseek/deepseek-ocr-2";
const BASE = "https://api.novita.ai/openai/v1/chat/completions";
const EXPECTED = new URL("../fixtures/expected.json", import.meta.url);
const IMG = (v) => new URL(`../fixtures/NW1-${v}.png`, import.meta.url);

const round2 = (n) => Math.round(n * 100) / 100;
const num = (s) => Number(String(s).replace(/[(),]/g, "").trim());

async function post(env, body) {
  const r = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.NOVITA_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Novita ${r.status}`);
  const j = await r.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

async function ocr(env, imgPath) {
  const b64 = readFileSync(imgPath).toString("base64");
  return post(env, {
    model: OCR_MODEL,
    max_tokens: 2200,
    temperature: 0,
    top_p: 1,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
      { type: "text", text: "Free OCR." },
    ] }],
  });
}

async function semanticDiff(env, model, text, baseline) {
  const prompt =
    `Baseline from the lender's system (prior quarter): EBITDA = ${baseline.ebitda}; ` +
    `Net interest expense = ${baseline.interest}.\n` +
    `Below is an OCR transcription of the borrower's restated statement. Line labels may have changed.\n` +
    `Identify the successor line of the EBITDA concept and the successor line of net interest expense.\n` +
    `Reply with ONLY strict JSON: {"earnings_label": str, "earnings_value": number, ` +
    `"interest_label": str, "interest_value": number, "renamed": bool, "why": str}\n` +
    `Do not compute any ratio.\n\n--- TRANSCRIPTION ---\n${text}`;
  const raw = await post(env, {
    model, max_tokens: 300, temperature: 0,
    chat_template_kwargs: { thinking: false },
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
}

// The statement is internally consistent iff rev - cost - opex == earnings and
// earnings - D&A - interest == pretax. A hallucinated OCR read breaks the chain.
function guardOk(text, diff) {
  const grab = (re) => { const m = text.match(re); return m ? num(m[1]) : null; };
  const rev = grab(/Net revenue\s*\(?([\d,]+)/i);
  const cor = grab(/Cost of revenue\s*\(?([\d,]+)/i);
  const opex = grab(/Operating expenses\s*\(?([\d,]+)/i);
  const da = grab(/Depreciation[^\n]*?\(?([\d,]+)/i);
  const pretax = grab(/before income taxes\s*\(?(-?[\d,]+)/i);
  if ([rev, cor, opex, da, pretax].some((x) => x == null)) return false;
  const e = diff.earnings_value, i = diff.interest_value;
  if (!(e > 0 && i > 0)) return false;
  // Statement outflows/losses print in parens; compare magnitudes so the sign
  // convention of the scan can't trip an otherwise-consistent read.
  const earningsOk = Math.abs(rev - cor - opex - e) <= 1;
  const pretaxOk = Math.abs(Math.abs(e - da - i) - Math.abs(pretax)) <= 1;
  return earningsOk && pretaxOk;
}

function synthetic(serial, exp, note) {
  const baseline = exp.baseline;
  const corrected = round2(exp.ebitda / exp.interest);
  const naive = round2(baseline.ebitda / exp.interest);
  return {
    mode: "SYNTHETIC", deal: "NW-1", serial, note: note || "deterministic (offline)",
    label_e: exp.label_e, ebitda: exp.ebitda, label_i: exp.label_i, interest: exp.interest,
    renamed: exp.label_e !== baseline.label_e || exp.label_i !== baseline.label_i,
    baseline_ratio: round2(baseline.ebitda / baseline.interest),
    naive, corrected, threshold: exp.floor, breach: corrected < exp.floor,
    why: `Baseline ${baseline.label_e} ${baseline.ebitda} succeeded by ${exp.label_e} ${exp.ebitda}.`,
  };
}

// variant: "A".."D". Returns a reading with a load-bearing mode label.
export async function readStatement(variant, env, opts = {}) {
  const expected = JSON.parse(readFileSync(EXPECTED, "utf8"));
  const serial = `NW1-R3-${variant}`;
  const exp = expected[serial];
  if (!exp) throw new Error(`no fixture for ${serial}`);

  if (opts.offline || !env.NOVITA_API_KEY) return synthetic(serial, exp);

  const model = env.NOVITA_MODEL || "deepseek/deepseek-v4-flash";
  const img = opts.image ? new URL(`file://${opts.image}`) : IMG(variant);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await ocr(env, img);
      const diff = await semanticDiff(env, model, text, exp.baseline);
      if (!guardOk(text, diff)) continue;
      const corrected = round2(diff.earnings_value / diff.interest_value);
      const naive = round2(exp.baseline.ebitda / diff.interest_value);
      const clean = (s) => String(s).replace(/[\s(\[]*\d[)\]]?\s*$/, "").trim();
      return {
        mode: "REAL", deal: "NW-1", serial, note: "read live via Novita DeepSeek-OCR",
        label_e: clean(diff.earnings_label), ebitda: diff.earnings_value,
        label_i: clean(diff.interest_label), interest: diff.interest_value,
        renamed: !!diff.renamed,
        baseline_ratio: round2(exp.baseline.ebitda / exp.baseline.interest),
        naive, corrected, threshold: exp.floor, breach: corrected < exp.floor,
        why: diff.why, ocr_excerpt: text.slice(0, 240),
      };
    }
    return synthetic(serial, exp, "OCR guard tripped — fell back to deterministic");
  } catch (e) {
    return synthetic(serial, exp, `live read failed (${String(e.message || e).slice(0, 40)}) — deterministic`);
  }
}
