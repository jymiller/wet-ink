import { readFileSync } from "node:fs";

// Zero-dependency .env loader — real env wins, .env fills the gaps.
export function loadEnv() {
  const env = { ...process.env };
  try {
    const txt = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const raw of txt.split("\n")) {
      const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env — offline */
  }
  return env;
}
