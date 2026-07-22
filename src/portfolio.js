// Deterministic portfolio generator for the DSCR covenant fleet.
// Seeded LCG only (no Math.random) so the 100-deal grid is identical every run.

const BORROWER_PREFIX = [
  "Cedar Ridge", "Harbor Point", "Iron Gate", "Summit", "Blue Harbor",
  "Northwind", "Silverlake", "Granite", "Meridian", "Copper Creek",
  "Lakeside", "Redstone", "Foxglen", "Brightwater", "Old Mill",
  "Pinecrest", "Kestrel", "Marlin Bay", "Sable", "Vantage",
  "Willow Bend", "Sterling", "Camden", "Hollow Oak", "Dovecrest",
];

const BORROWER_SUFFIX = [
  "Logistics", "Medical Group", "Properties", "Partners", "Holdings",
  "Industries", "Realty", "Capital", "Ventures", "Storage",
  "Hospitality", "Manufacturing", "Senior Living", "Data Centers", "Retail Group",
];

const SECTORS = [
  "Multifamily", "Industrial", "Retail", "Office", "Hospitality",
  "Healthcare", "Self-Storage", "Logistics", "Data Center", "Senior Housing",
];

const NOI_LABELS = ["Adjusted NOI", "Normalized operating income"];
const DS_LABEL_ALT = "Total debt service";
const THRESHOLDS = [1.1, 1.2, 1.25];

const round2 = (x) => Math.round(x * 100) / 100;

export function genPortfolio(n = 100, seed = 7) {
  let state = (seed >>> 0) || 1;
  const rand = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (lo, hi) => lo + rand() * (hi - lo);

  const now = Date.now();
  const deals = [];

  for (let i = 0; i < n; i++) {
    const breach = rand() < 0.4;
    const threshold = pick(THRESHOLDS);
    const debt_service = Math.round(between(90, 260));
    const factor = breach ? between(0.85, 0.98) : between(1.05, 1.4);
    const noi = Math.round(debt_service * threshold * factor);
    const actual_dscr = noi / debt_service;
    const baseline_dscr = round2(actual_dscr + between(-0.06, 0.06));

    const label_noi = rand() < 0.6 ? "Net operating income" : pick(NOI_LABELS);
    const label_ds = rand() < 0.8 ? "Annual debt service" : DS_LABEL_ALT;

    deals.push({
      id: `D-${String(i + 1).padStart(3, "0")}`,
      borrower: `${pick(BORROWER_PREFIX)} ${pick(BORROWER_SUFFIX)}`,
      sector: pick(SECTORS),
      threshold,
      label_noi,
      noi,
      label_ds,
      debt_service,
      baseline_dscr,
      dscr: null,
      status: "queued",
      note: "",
      updated_at: now,
    });
  }

  return deals;
}
