// node scripts/fleet.js [N] [concurrency] [batchSize] [model]
import { loadEnv } from "../src/env.js";
import { genDeals, runFleet } from "../src/fleet.js";

const env = loadEnv();
const N = +(process.argv[2] || 200);
const C = +(process.argv[3] || 5);
const B = +(process.argv[4] || 25);
const model = process.argv[5] || env.NOVITA_MODEL || "deepseek/deepseek-v4-flash";

const deals = genDeals(N);
const truthBreach = deals.filter((d) => d.truth.breach).length;
process.stdout.write(`\n\x1b[1mNOVITA FLEET SCAN\x1b[0m  ${N} deals  ·  ${B}/call  ·  ${C} calls in parallel  ·  ${model}\n`);
process.stdout.write(`\x1b[38;5;244mno OCR — pure covenant reasoning at scale · ground truth: ${truthBreach} breaches / ${N}\x1b[0m\n\n`);

let last = -1;
const r = await runFleet(deals, env, {
  concurrency: C, batchSize: B, model,
  onProgress: (s) => {
    if (s.done !== last) {
      last = s.done;
      const w = 34, fill = Math.round((s.done / N) * w);
      const bar = "\x1b[38;5;42m" + "█".repeat(fill) + "\x1b[38;5;238m" + "·".repeat(w - fill) + "\x1b[0m";
      const rate = s.elapsed ? (s.done / s.elapsed).toFixed(0) : "0";
      process.stdout.write(`\r[${bar}] ${String(s.done).padStart(4)}/${N}  batches in-flight \x1b[38;5;179m${s.active}\x1b[0m  breach \x1b[38;5;167m${String(s.breaches).padStart(3)}\x1b[0m  \x1b[38;5;42m${rate}/s\x1b[0m   `);
    }
  },
});

console.log(`\n\n\x1b[1mDONE\x1b[0m in \x1b[38;5;42m${r.elapsed.toFixed(1)}s\x1b[0m  (${r.calls} Novita calls, peak ${r.peak} in flight)`);
console.log(`  throughput   \x1b[1m${r.throughput}\x1b[0m deals/sec`);
console.log(`  batch latency p50 ${r.batchP50}ms  ·  p95 ${r.batchP95}ms  (per ${B}-deal call)`);
console.log(`  breaches     ${r.breaches} flagged  (truth ${truthBreach})`);
console.log(`  accuracy     \x1b[1m${r.accuracy}%\x1b[0m vs ground truth  (${r.correct}/${r.done})`);
console.log(`  dropped      ${r.errors}`);
console.log("");
