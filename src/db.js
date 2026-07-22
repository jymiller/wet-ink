import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const DATA_FILE = fileURLToPath(new URL("../data/deals.json", import.meta.url));

export function createDB(deals = []) {
  const map = new Map(deals.map((d) => [d.id, d]));
  const subs = new Set();

  const coordinator = {
    fleetSize: 0,
    queueDepth: 0,
    throughput: 0,
    cost: 0,
    elapsed: 0,
    running: false,
  };

  const all = () => [...map.values()];

  function persist() {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(all(), null, 2));
    } catch {
      /* best-effort */
    }
  }

  function notify() {
    for (const fn of subs) {
      try {
        fn();
      } catch {
        /* subscriber errors are their own problem */
      }
    }
  }

  function get(id) {
    return map.get(id);
  }

  function set(id, patch) {
    const cur = map.get(id) || { id };
    const next = { ...cur, ...patch, updated_at: Date.now() };
    map.set(id, next);
    persist();
    notify();
    return next;
  }

  function seed(newDeals) {
    map.clear();
    for (const d of newDeals) map.set(d.id, d);
    persist();
    notify();
  }

  function stats() {
    const s = { total: 0, queued: 0, scanning: 0, clear: 0, breach: 0, error: 0 };
    for (const d of map.values()) {
      s.total++;
      if (s[d.status] !== undefined) s[d.status]++;
    }
    return s;
  }

  function subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  return { all, get, set, seed, stats, coordinator, subscribe };
}
