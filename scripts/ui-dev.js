import { createServer } from "node:http";
import { readFileSync } from "node:fs";

// UI-dev server: serves the cockpit against FROZEN golden fixtures so the UI
// session develops independently of src/ and server.js (owned by the backend
// session). Same routes the real server exposes, but /api/* replays captured
// output instead of running the kernel. Contract reference: fixtures/*.golden.json.
//   node scripts/ui-dev.js   → http://localhost:8081

const PORT = process.env.UI_PORT || 8081;
const file = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const sendJson = (res, buf) => {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(buf);
};

createServer((req, res) => {
  const path = req.url.split("?")[0];
  try {
    if (path === "/health") { res.writeHead(200); return res.end("ok"); }
    if (path === "/" || path === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(file("public/cockpit.html"));
    }
    if (path === "/escalation.mp3") {
      res.writeHead(200, { "content-type": "audio/mpeg", "cache-control": "no-store" });
      return res.end(file("public/escalation.mp3"));
    }
    if (path === "/api/run") return sendJson(res, file("fixtures/run.golden.json"));
    if (path === "/api/attest" && req.method === "POST") return sendJson(res, file("fixtures/attest.golden.json"));
    res.writeHead(404); res.end("not found");
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
}).listen(PORT, () => console.log(`wet-ink UI-dev (fixtures) → http://localhost:${PORT}`));
