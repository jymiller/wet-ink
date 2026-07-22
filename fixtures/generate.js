// Parameterized statement generator (workstream B).
//   node fixtures/generate.js
// Writes NW1-{A,B,C,D}.html next to itself plus expected.json (ground truth
// for the semantic-diff tests). Degradation is vector-drawn so it prints crisp.
// Variants: A rename+restate, B footnote reclass, C interest-side rename,
// D decoy (renamed but healthy — the agent must stay green).

import { writeFileSync } from "node:fs";

const FLOOR = 1.4;
const BASELINE = { ebitda: 320, interest: 210, label_e: "EBITDA", label_i: "Net interest expense" };

const VARIANTS = [
  {
    serial: "NW1-R3-A",
    label_e: "Adjusted EBITDA", ebitda: 285, note_e: 1,
    label_i: "Net interest expense", interest: 214,
    rev: 1842, cor: 1121, opex: 436, da: 96,
    notes: [
      "Adjusted EBITDA excludes $14 of non-recurring integration costs relating to the Meridian facility consolidation.",
      "Amounts are presented in thousands of U.S. dollars and are unaudited.",
    ],
  },
  {
    serial: "NW1-R3-B",
    label_e: "EBITDA", ebitda: 291, note_e: 2,
    label_i: "Net interest expense", interest: 214,
    rev: 1858, cor: 1130, opex: 437, da: 98,
    notes: [
      "Amounts are presented in thousands of U.S. dollars and are unaudited.",
      "EBITDA for the current period reflects reclassification of $38 of recurring platform maintenance previously reported within operating expenses. Prior periods have not been restated for comparability.",
    ],
  },
  {
    serial: "NW1-R3-C",
    label_e: "EBITDA", ebitda: 322, note_e: null,
    label_i: "Net finance charges", interest: 236, note_i: 3,
    rev: 1871, cor: 1118, opex: 431, da: 97,
    notes: [
      "Amounts are presented in thousands of U.S. dollars and are unaudited.",
      "Certain prior-period captions have been conformed to current presentation.",
      "Net finance charges comprise interest expense following the July facility rate reset together with associated amendment fees.",
    ],
  },
  {
    serial: "NW1-R3-D",
    label_e: "Adjusted EBITDA", ebitda: 334, note_e: 1,
    label_i: "Net interest expense", interest: 216,
    rev: 1904, cor: 1132, opex: 438, da: 95,
    notes: [
      "Adjusted EBITDA excludes $9 of non-recurring relocation costs.",
      "Amounts are presented in thousands of U.S. dollars and are unaudited.",
    ],
  },
];

// Deterministic speckle so reprints are identical.
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function speckle(seed, n, w, h) {
  const r = lcg(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = (r() * w).toFixed(1), y = (r() * h).toFixed(1);
    const rad = (0.2 + r() * 0.9).toFixed(2), o = (0.06 + r() * 0.22).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${rad}" fill="#2b2620" opacity="${o}"/>`;
  }
  return out;
}

const fmt = (n) => n.toLocaleString("en-US");
const money = (n) => (n < 0 ? `(${fmt(-n)})` : fmt(n));

function page(v, idx) {
  const gross = v.rev - v.cor;
  const opInc = v.ebitda - v.da;
  const pretax = opInc - v.interest;
  const rot = [0.7, -0.55, 0.85, -0.4][idx];
  const seed = 1000 + idx * 77;
  const sup = (n) => (n ? `<sup>(${n})</sup>` : "");
  const row = (l, a, cls = "") => `<tr class="${cls}"><td>${l}</td><td>${a}</td></tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${v.serial}</title>
<style>
  @page { size: letter; margin: 0; }
  html, body { margin: 0; padding: 0; background: #e9e5da; }
  .sheet {
    position: relative; width: 8.5in; height: 11in; margin: 0 auto; overflow: hidden;
    background: linear-gradient(104deg, #f6f3ea 0%, #efeadd 46%, #f4f0e6 74%, #eae4d5 100%);
    color: #26221a; font-family: Georgia, "Times New Roman", serif;
  }
  .content { position: absolute; inset: 0; padding: 0.55in 0.85in; transform: rotate(${rot}deg); }
  .faxline {
    font-family: "Courier New", Courier, monospace; font-size: 9.5px; letter-spacing: 0.06em;
    color: #4a443a; border-bottom: 1px solid #4a443a; padding-bottom: 3px;
    display: flex; justify-content: space-between;
  }
  .head { text-align: center; margin-top: 26px; }
  .head .co { font-size: 21px; letter-spacing: 0.12em; font-variant: small-caps; }
  .head .addr { font-size: 10.5px; color: #56503f; margin-top: 3px; }
  .head .title { font-size: 13.5px; margin-top: 16px; font-weight: bold; }
  .head .period { font-size: 11px; color: #3d382c; margin-top: 3px; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12.5px; }
  td { padding: 5.5px 2px; border-bottom: 1px solid #cfc8b4; }
  td:last-child { text-align: right; font-variant-numeric: tabular-nums; width: 110px; }
  tr.total td { border-top: 1.5px solid #26221a; border-bottom: 3px double #26221a; font-weight: bold; }
  tr.sub td { font-weight: bold; }
  sup { font-size: 8.5px; }
  .notes { margin-top: 26px; font-size: 10px; color: #3a352a; line-height: 1.55; }
  .notes .n { margin-top: 5px; }
  .sig { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; }
  .sig .line { border-top: 1px solid #26221a; padding-top: 4px; width: 2.4in; }
  .sig .script { font-family: "Snell Roundhand", "Brush Script MT", cursive; font-size: 20px; transform: rotate(-3deg); margin-bottom: 2px; color: #1f2f52; }
  .serial { position: absolute; bottom: 0.32in; right: 0.5in; font-family: "Courier New", monospace; font-size: 8.5px; color: #6d6552; }
  .grime { position: absolute; inset: 0; pointer-events: none; }
  .band { position: absolute; top: 0; bottom: 0; left: 62%; width: 34px; background: rgba(43, 38, 32, 0.045); }
</style></head><body>
<div class="sheet">
  <div class="content">
    <div class="faxline"><span>07/21 08:12 FROM:NORTHWIND FIN-OPS 415 555 0164</span><span>P.01/01</span></div>
    <div class="head">
      <div class="co">Northwind Provisions LLC</div>
      <div class="addr">2140 Alameda Point Blvd &middot; Alameda, CA 94501</div>
      <div class="title">Quarterly Financial Summary (Restated)</div>
      <div class="period">Three months ended September 30 &mdash; Facility NW-1 reporting package</div>
    </div>
    <table>
      ${row("Net revenue", fmt(v.rev))}
      ${row("Cost of revenue", `(${fmt(v.cor)})`)}
      ${row("Gross profit", fmt(gross), "sub")}
      ${row("Operating expenses", `(${fmt(v.opex)})`)}
      ${row(`${v.label_e}${sup(v.note_e)}`, fmt(v.ebitda), "sub")}
      ${row("Depreciation and amortization", `(${fmt(v.da)})`)}
      ${row("Operating income", fmt(opInc))}
      ${row(`${v.label_i}${sup(v.note_i)}`, `(${fmt(v.interest)})`)}
      ${row("Income (loss) before income taxes", money(pretax), "total")}
    </table>
    <div class="notes">
      Notes to the quarterly summary:
      ${v.notes.map((n, i) => `<div class="n">(${i + 1}) ${n}</div>`).join("")}
    </div>
    <div class="sig">
      <div><div class="script">M. Okafor</div><div class="line">M. Okafor, Corporate Controller</div></div>
      <div class="line" style="width:1.6in">Date: October 24</div>
    </div>
  </div>
  <svg class="grime" viewBox="0 0 816 1056" preserveAspectRatio="none">
    ${speckle(seed, 210, 816, 1056)}
    <ellipse cx="668" cy="188" rx="52" ry="46" fill="none" stroke="#7a5a33" stroke-width="7" opacity="0.13"/>
    <ellipse cx="666" cy="190" rx="45" ry="40" fill="none" stroke="#7a5a33" stroke-width="2.5" opacity="0.18"/>
    <path d="M0 1006 q408 -14 816 6 l0 44 l-816 0 z" fill="#2b2620" opacity="0.05"/>
  </svg>
  <div class="band"></div>
  <div class="serial">${v.serial}</div>
</div>
</body></html>`;
}

const expected = {};
VARIANTS.forEach((v, i) => {
  const ratio = +(v.ebitda / v.interest).toFixed(2);
  expected[v.serial] = {
    baseline: BASELINE, floor: FLOOR,
    label_e: v.label_e, ebitda: v.ebitda, label_i: v.label_i, interest: v.interest,
    ratio, breach: ratio < FLOOR,
  };
  const f = new URL(`./${v.serial.slice(-1) === "A" ? "NW1-A" : v.serial.slice(-1) === "B" ? "NW1-B" : v.serial.slice(-1) === "C" ? "NW1-C" : "NW1-D"}.html`, import.meta.url);
  writeFileSync(f, page(v, i));
  console.log(`${v.serial}  ${v.label_e} ${v.ebitda} / ${v.label_i} ${v.interest}  = ${ratio}  ${ratio < FLOOR ? "BREACH" : "clear"}`);
});
writeFileSync(new URL("./expected.json", import.meta.url), JSON.stringify(expected, null, 2) + "\n");
console.log("wrote NW1-{A,B,C,D}.html + expected.json");
