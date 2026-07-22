import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { loadEnv } from "./src/env.js";
import { run, attest } from "./src/kernel.js";
import { createDB } from "./src/db.js";
import { genPortfolio } from "./src/portfolio.js";
import { runPortfolio, simulatePortfolio } from "./src/coordinator.js";

// Hosts the cockpit. Runs locally and lights-out on an Akash lease.
//   GET  /              → the cockpit UI
//   GET  /api/run       → runs the loop to the attestation point, returns events
//   POST /api/attest    → the human attests; the denied action runs as operator
//   GET  /fleet         → the portfolio-watch dashboard
//   GET  /api/portfolio → the 100-deal grid state (deals + stats + coordinator)
//   POST /api/scan      → kick off the adaptive fleet scan (non-blocking)

const PORT = process.env.PORT || 8080;
const env = loadEnv();
let session = null; // single-user demo state
const pdb = createDB(genPortfolio(100)); // portfolio-monitoring state

const cockpit = () => readFileSync(new URL("./public/cockpit.html", import.meta.url), "utf8");
const fleet = () => readFileSync(new URL("./public/fleet.html", import.meta.url), "utf8");
const json = (res, obj) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
};

createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("ok");
    }
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(cockpit());
    }
    if (req.url.split("?")[0] === "/escalation.mp3") {
      try {
        const buf = readFileSync(new URL("./public/escalation.mp3", import.meta.url));
        res.writeHead(200, { "content-type": "audio/mpeg", "cache-control": "no-store" });
        return res.end(buf);
      } catch {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("no audio");
      }
    }
    if (req.url === "/api/run") {
      const events = [];
      const r = await run(env, (e) => events.push(e));
      session = r.pending ? { state: r.state, pending: r.pending, cycle: r.cycle } : null;
      return json(res, { events, pending: !!r.pending });
    }
    if (req.url === "/api/attest" && req.method === "POST") {
      if (!session) return json(res, { events: [], error: "nothing is awaiting attestation" });
      const events = [];
      await attest(env, session, (e) => events.push(e));
      session = null;
      return json(res, { events, done: true });
    }
    if (req.url.split("?")[0] === "/fleet") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(fleet());
    }
    if (req.url.split("?")[0] === "/test") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(readFileSync(new URL("./public/test.html", import.meta.url), "utf8"));
    }
    if (req.url.split("?")[0] === "/api/portfolio") {
      return json(res, { deals: pdb.all(), stats: pdb.stats(), coordinator: pdb.coordinator });
    }
    if (req.url.split("?")[0] === "/api/scan" && req.method === "POST") {
      if (pdb.coordinator.running) return json(res, { already: true });
      pdb.coordinator.running = true;
      const sim = /[?&]sim=1/.test(req.url);
      const p = sim ? simulatePortfolio(pdb, { onTick: () => {} }) : runPortfolio(pdb, env, { onTick: () => {} });
      p.catch(() => { pdb.coordinator.running = false; });
      return json(res, { started: true, mode: sim ? "simulate" : "live" });
    }
    if (req.url.split("?")[0] === "/api/reset" && req.method === "POST") {
      pdb.seed(pdb.all().map((d) => ({ ...d, status: "queued", dscr: null, note: "" })));
      Object.assign(pdb.coordinator, { fleetSize: 0, queueDepth: 0, throughput: 0, cost: 0, elapsed: 0, running: false });
      return json(res, { reset: true });
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
}).listen(PORT, () => console.log(`wet-ink cockpit → http://localhost:${PORT}`));
