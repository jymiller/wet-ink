// Portfolio coordinator — an ADAPTIVE fleet of batch-workers that judges ~100
// loan covenants for DSCR breaches. Concurrency tracks queue depth (cap 6): the
// fleet visibly scales up, then drains down as the queue empties. Each worker
// fires ONE cheap Novita call over a whole batch (the model maps possibly-renamed
// line items by meaning and computes DSCR); our policy applies the floor. With no
// key / no network it falls back to a deterministic local read labeled SYNTHETIC,
// so the demo floor always holds. Self-contained: imports nothing.

const CHAT = "https://api.novita.ai/openai/v1/chat/completions";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
// Live terminal monitor — prints to the server's stdout so you can watch the
// fleet's agents fire real Novita calls during a LIVE scan (SIMULATE never calls
// out, so a quiet terminal there vs. a busy one here is the proof it's real).
const flog = (s) => { try { console.log("\x1b[38;5;42m[fleet]\x1b[0m " + s); } catch { /* never break the run on a log */ } };

// Judge a batch in one call. Returns { map: id -> {dscr,breach}, cost }, or
// { map: null } to signal the caller should fall back to the local read.
async function judgeBatch(batch, model, env) {
  if (!env.NOVITA_API_KEY) return { map: null, cost: 0 };
  const lines = batch
    .map(
      (d) =>
        `id=${d.id} floor=${d.threshold} | "${d.label_noi}"=${d.noi} | "${d.label_ds}"=${d.debt_service}`
    )
    .join("\n");
  const prompt =
    `You are auditing loan covenants. For EACH deal below, map the two lines to the correct concept ` +
    `by meaning (Net Operating Income vs Annual Debt Service — either may be renamed), compute ` +
    `DSCR = NOI / Debt Service, and decide breach (DSCR < that deal's floor).\n\n` +
    `${lines}\n\n` +
    `Reply ONLY strict JSON: {"results":[{"id":string,"dscr":number,"breach":boolean}]} ` +
    `with exactly one entry per deal, ids matching.`;

  for (let a = 1; a <= 4; a++) {
    let res;
    try {
      res = await fetch(CHAT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.NOVITA_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 90 + batch.length * 38,
          temperature: 0,
          chat_template_kwargs: { thinking: false },
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch {
      await sleep(1500 * a);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(1500 * a);
      continue;
    }
    if (!res.ok) return { map: null, cost: 0 }; // non-retryable -> local fallback

    let j;
    try {
      j = await res.json();
    } catch {
      await sleep(1500 * a);
      continue;
    }

    const content = (j.choices?.[0]?.message?.content ?? "")
      .replace(/^```json\s*|\s*```$/g, "")
      .trim();
    let results = [];
    try {
      results = JSON.parse(content).results || [];
    } catch {
      // salvage whole result objects from a truncated / wrapped response
      for (const m of content.matchAll(/\{[^{}]*"id"\s*:\s*"[^"]+"[^{}]*\}/g)) {
        try {
          results.push(JSON.parse(m[0]));
        } catch {
          /* skip partial fragment */
        }
      }
    }
    const map = new Map();
    for (const r of results) if (r && r.id != null) map.set(String(r.id), r);
    const toks = j.usage?.total_tokens ?? 90 + batch.length * 38;
    return { map, cost: Math.max(0, toks * 1e-7) };
  }
  return { map: null, cost: 0 }; // retries exhausted -> local fallback
}

export async function runPortfolio(db, env, opts = {}) {
  const model =
    opts.model ||
    env.FLEET_MODEL ||
    env.NOVITA_MODEL ||
    "deepseek/deepseek-v4-flash";
  const batchSize = opts.batchSize || 20;

  if (!db.coordinator) db.coordinator = {};

  // Reset every deal to queued / no reading, then arm the coordinator.
  db.seed(db.all().map((d) => ({ ...d, status: "queued", dscr: null, note: "" })));
  db.coordinator.running = true;

  const total = db.all().length;
  const t0 = Date.now();
  let totalCost = 0;
  flog(`LIVE scan starting · model ${model} · ${total} deals`);

  const counts = () => {
    const c = { queued: 0, scanning: 0, clear: 0, breach: 0, error: 0 };
    for (const d of db.all()) if (c[d.status] !== undefined) c[d.status]++;
    return c;
  };

  const emitTick = (fleetSize) => {
    const c = counts();
    const elapsed = +((Date.now() - t0) / 1000).toFixed(2);
    const processed = c.clear + c.breach + c.error;
    const tick = {
      processed,
      total,
      fleetSize,
      queueDepth: c.queued,
      throughput: elapsed > 0 ? +(processed / elapsed).toFixed(2) : 0,
      breaches: c.breach,
      cost: +totalCost.toFixed(6),
      elapsed,
    };
    Object.assign(db.coordinator, {
      fleetSize: tick.fleetSize,
      queueDepth: tick.queueDepth,
      throughput: tick.throughput,
      cost: tick.cost,
      elapsed: tick.elapsed,
      running: true,
    });
    if (opts.onTick) {
      try {
        opts.onTick(tick);
      } catch {
        /* never let a listener break the run */
      }
    }
  };

  // Atomically claim up to batchSize queued deals (synchronous — no await, so no
  // two workers can grab the same deal). Snapshot the fields the worker needs.
  const claimBatch = () => {
    const batch = [];
    for (const d of db.all()) {
      if (d.status === "queued") {
        batch.push({
          id: d.id,
          threshold: d.threshold,
          noi: d.noi,
          debt_service: d.debt_service,
          label_noi: d.label_noi,
          label_ds: d.label_ds,
        });
        if (batch.length >= batchSize) break;
      }
    }
    for (const d of batch) db.set(d.id, { status: "scanning" });
    return batch;
  };

  // Judge one batch, then resolve every claimed deal to clear/breach (never leave
  // a deal stuck in "scanning"). REAL when the model read it; SYNTHETIC on the
  // deterministic local fallback; error only on an unexpected per-deal failure.
  const worker = async (batch) => {
    const wt = Date.now();
    flog(`worker → POST ${model} · ${batch.length} deals · firing`);
    let map = null, cost = 0;
    try {
      const r = await judgeBatch(batch, model, env);
      map = r.map;
      cost = r.cost;
      totalCost += r.cost;
    } catch {
      map = null;
    }
    flog(`  ← ${map ? "REAL" : "SYNTHETIC(fallback)"} · ${batch.length} deals · $${cost.toFixed(6)} · ${Date.now() - wt}ms`);
    for (const d of batch) {
      try {
        const r = map ? map.get(d.id) : null;
        let dscr, note;
        if (r && Number.isFinite(Number(r.dscr))) {
          dscr = +Number(r.dscr).toFixed(2);
          note = "REAL";
        } else {
          dscr = d.debt_service ? +(d.noi / d.debt_service).toFixed(2) : 0;
          note = "SYNTHETIC";
        }
        const breach = dscr < d.threshold; // our floor, applied deterministically
        db.set(d.id, { dscr, status: breach ? "breach" : "clear", note });
      } catch {
        try {
          db.set(d.id, { status: "error", note: "error" });
        } catch {
          /* db unavailable — nothing more we can do for this deal */
        }
      }
    }
  };

  try {
    const active = new Set();
    emitTick(0);
    while (true) {
      const c = counts();
      if (c.queued === 0 && active.size === 0) break;

      const target = clamp(Math.ceil(c.queued / 20), 1, 6);
      while (active.size < target && counts().queued > 0) {
        const batch = claimBatch();
        if (batch.length === 0) break;
        const p = worker(batch)
          .catch(() => {})
          .finally(() => active.delete(p));
        active.add(p);
      }

      emitTick(active.size);

      if (active.size > 0) {
        // wake on the next worker completion, or a short interval, whichever first
        await Promise.race([...active, sleep(200)]);
      }
    }
  } finally {
    const fc = counts();
    flog(`done · ${fc.clear + fc.breach} judged · ${fc.breach} breaches · $${totalCost.toFixed(6)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    db.coordinator.running = false;
    emitTick(0);
    db.coordinator.running = false; // emitTick re-sets running:true; keep it false
  }
}

// SIMULATED run — deterministic, offline (zero Novita cost), and PACED so the
// portfolio visibly fills over ~20s. Documents arrive in waves (an `arrived`
// flag gates processing); the simulated fleet scales with the live backlog.
// Same db + db.coordinator contract as runPortfolio, so the dashboard is identical.
export async function simulatePortfolio(db, opts = {}) {
  const pace = opts.pace ?? 380;   // ms between resolve ticks
  const chunk = opts.chunk ?? 3;   // deals resolved per tick (granular grid fill)
  const waves = Math.max(1, opts.waves ?? 3);
  const waveGapMs = opts.waveGapMs ?? 3000;
  if (!db.coordinator) db.coordinator = {};

  const ids = db.all().map((d) => d.id);
  const per = Math.ceil(ids.length / waves);
  const waveOf = new Map(ids.map((id, i) => [id, Math.floor(i / per)]));
  // Reset: everything queued; only wave 0 has "arrived" (is processable).
  db.seed(db.all().map((d) => ({ ...d, status: "queued", dscr: null, note: "", arrived: waveOf.get(d.id) === 0 })));
  db.coordinator.running = true;

  const total = ids.length;
  const t0 = Date.now();
  let processed = 0, breaches = 0, cost = 0, curWave = 0, nextWaveAt = Date.now() + waveGapMs;

  const readyList = () => db.all().filter((d) => d.status === "queued" && d.arrived);
  const tick = (fleetSize) => {
    const scanning = db.all().filter((d) => d.status === "scanning").length;
    const elapsed = +((Date.now() - t0) / 1000).toFixed(2);
    Object.assign(db.coordinator, {
      fleetSize, queueDepth: readyList().length + scanning,
      throughput: elapsed > 0 ? +(processed / elapsed).toFixed(2) : 0,
      cost: +cost.toFixed(6), elapsed, running: true,
    });
    if (opts.onTick) { try { opts.onTick({ processed, total, breaches, elapsed }); } catch { /* ignore */ } }
  };

  try {
    tick(0);
    while (processed < total) {
      // release the next wave of arrivals over time
      if (curWave < waves - 1 && Date.now() >= nextWaveAt) {
        curWave++;
        for (const d of db.all()) if (waveOf.get(d.id) === curWave) db.set(d.id, { arrived: true });
        nextWaveAt = Date.now() + waveGapMs;
      }
      const ready = readyList().slice(0, chunk);
      if (ready.length === 0) { tick(0); await sleep(pace); continue; }
      for (const d of ready) db.set(d.id, { status: "scanning" });
      const backlog = readyList().length + ready.length;
      tick(clamp(Math.ceil(backlog / 8), 1, 6)); // fleet scales with the queue
      await sleep(pace);
      for (const d of ready) {
        const dscr = d.debt_service ? +(d.noi / d.debt_service).toFixed(2) : 0;
        const breach = dscr < d.threshold;
        db.set(d.id, { dscr, status: breach ? "breach" : "clear", note: "SYNTHETIC" });
        processed++; if (breach) breaches++;
      }
    }
  } finally {
    db.coordinator.running = false;
    tick(0);
    db.coordinator.running = false;
  }
}
