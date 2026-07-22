import { loadEnv } from "./src/env.js";
import { run } from "./src/kernel.js";
import { cliEmit } from "./src/wall.js";

const env = loadEnv();
const r = await run(env, cliEmit);
if (r.pending) {
  console.log("\x1b[38;5;244m  Awaiting human attestation. Open the cockpit to attest and submit:\x1b[0m");
  console.log("\x1b[38;5;179m  node server.js  →  http://localhost:8080\x1b[0m\n");
}
