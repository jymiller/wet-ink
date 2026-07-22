// Portfolio-scale covenant scan. No OCR: deals are generated with known numbers,
// so the load-bearing Novita work is the REASONING at scale - hundreds of covenant
// judgments fired concurrently, each mapping possibly-renamed line items by meaning
// and deciding breach. Shows the platform ramping up and draining down.

const CHAT = "https://api.novita.ai/openai/v1/chat/completions";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SECTORS = ["Provisions", "Logistics", "Aerospace", "Biotech", "Retail", "Energy", "Media", "Fintech", "Agriculture", "Maritime"];
const EARN_RENAME = ["EBITDA", "Adjusted EBITDA", "Normalized EBITDA", "Underlying EBITDA"];

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// Generate n deals with ground truth. ~45% are engineered to breach.
export function genDeals(n, seed = 7) {
  const r = lcg(seed);
  const deals = [];
  for (let i = 0; i < n; i++) {
    const sector = SECTORS[Math.floor(r() * SECTORS.length)];
    const id = `${sector.slice(0, 3).toUpperCase()}-${1000 + i}`;
    const threshold = [1.25, 1.4, 1.5][Math.floor(r() * 3)];
    const baseI = 180 + Math.floor(r() * 90);
    const label_e = EARN_RENAME[Math.floor(r() * EARN_RENAME.length)]; // maybe renamed
    const interest = baseI + Math.floor(r() * 12);
    const breachIt = r() < 0.45;
    const factor = breachIt ? 0.88 + r() * 0.09 : 1.05 + r() * 0.18;
    const ebitda = Math.round(interest * threshold * factor);
    const ratio = +(ebitda / interest).toFixed(2);
    deals.push({
      id, sector, threshold,
      baseline: { label_e: "EBITDA", label_i: "Net interest expense" },
      restated: { label_e, ebitda, label_i: "Net interest expense", interest },
      truth: { ratio, breach: ratio < threshold },
    });
  }
  return deals;
}

// Judge a BATCH of deals in one Novita call (large-context reasoning). The model
// maps renamed lines by meaning, computes each ratio, and decides each breach.
// Returns a Map id -> {ratio, breach, renamed}. Retries with real backoff so it
// rides the account's 30 req/min limit instead of drowning in it.
export async function judgeBatch(batch, env, model, tries = 4) {
  const lines = batch
    .map((d, i) => `${i + 1}) id=${d.id} floor=${d.threshold} | "${d.restated.label_e}"=${d.restated.ebitda} | "${d.restated.label_i}"=${d.restated.interest}`)
    .join("\n");
  const prompt =
    `You are auditing loan covenants. For EACH deal, map any renamed earnings line to the EBITDA concept, ` +
    `compute Interest Coverage Ratio = earnings / net interest, and decide breach (ratio < that deal's floor).\n\n` +
    `${lines}\n\n` +
    `Reply ONLY strict JSON: {"results":[{"id":string,"ratio":number,"breach":boolean,"renamed":boolean}]} ` +
    `with exactly one entry per deal, matching ids.`;
  for (let a = 0; a < tries; a++) {
    let res;
    try {
      res = await fetch(CHAT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.NOVITA_API_KEY}` },
        body: JSON.stringify({
          model, max_tokens: 90 + batch.length * 38, temperature: 0,
          chat_template_kwargs: { thinking: false },
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch { await sleep(800 * (a + 1)); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (a + 1)); continue; }
    if (!res.ok) throw new Error(`Novita ${res.status}`);
    const j = await res.json();
    const content = j.choices[0].message.content.replace(/^```json\s*|\s*```$/g, "").trim();
    let results = [];
    try {
      results = JSON.parse(content).results || [];
    } catch {
      // salvage complete result objects from a truncated response
      for (const m of content.matchAll(/\{[^{}]*"id"\s*:\s*"[^"]+"[^{}]*\}/g)) {
        try { results.push(JSON.parse(m[0])); } catch { /* skip partial */ }
      }
    }
    const map = new Map();
    for (const r of results) map.set(r.id, r);
    return map;
  }
  throw new Error("retries exhausted");
}

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// Run the portfolio: chunk into batches, fire batches concurrently (each call
// reasons over many deals), aggregate. onProgress reports the live ramp -
// deals done, in-flight batch requests, breaches, throughput.
export async function runFleet(deals, env, opts = {}) {
  const model = opts.model || env.NOVITA_MODEL || "deepseek/deepseek-v4-flash";
  const batchSize = opts.batchSize || 25;
  const concurrency = opts.concurrency || 5;
  const batches = chunk(deals, batchSize);
  let bi = 0, done = 0, active = 0, peak = 0, breaches = 0, errors = 0, correct = 0, calls = 0;
  const lat = [];
  const t0 = Date.now();
  async function worker() {
    while (bi < batches.length) {
      const batch = batches[bi++];
      active++; peak = Math.max(peak, active); calls++;
      const s = Date.now();
      try {
        const map = await judgeBatch(batch, env, model);
        lat.push(Date.now() - s);
        for (const d of batch) {
          const v = map.get(d.id);
          if (!v) { errors++; continue; }
          if (v.breach) breaches++;
          if (!!v.breach === d.truth.breach) correct++;
          done++;
        }
      } catch { errors += batch.length; }
      active--;
      if (opts.onProgress) opts.onProgress({ done, errors, total: deals.length, active, breaches, correct, calls, elapsed: (Date.now() - t0) / 1000 });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  lat.sort((a, b) => a - b);
  const elapsed = (Date.now() - t0) / 1000;
  const pick = (q) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] : 0;
  return {
    total: deals.length, done, breaches, errors, correct, elapsed, peak, calls, batchSize, concurrency, model,
    throughput: +(done / elapsed).toFixed(1), batchP50: pick(0.5), batchP95: pick(0.95),
    accuracy: done ? +((correct / done) * 100).toFixed(1) : 0,
  };
}
