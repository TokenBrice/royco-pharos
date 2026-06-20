import { UNDERLYING_FIXTURES } from "../src/lib/roycopharos/fixtures";
import { loadPharosUnderlyings } from "../src/lib/roycopharos/pharos-client";
import { loadRoycoDawnMarkets } from "../src/lib/roycopharos/royco-dawn";
import { buildSnapshot } from "../src/lib/roycopharos/snapshot";
import { HAIRCUT_CAP, METHODOLOGY_VERSION, OPPORTUNITY_BANDS, SAFETY_BANDS } from "../src/lib/roycopharos/scoring";
import type { RoycoTrancheView } from "../src/lib/roycopharos/types";

// Calibration harness (agents/roycopharos-calibrated.md gate). Scores the full pull under the
// production engine and prints the Safety + Opportunity distribution, per-factor haircut
// contribution, and PASS/FAIL anchor checks. Re-run on live data with
// ROYCO_DAWN_LIVE=1 PHAROS_API_KEY=… npm run calibrate before any external display.

const now = Math.floor(Date.now() / 1000);
const royco = await loadRoycoDawnMarkets();
const requiredIds = [
  ...new Set(
    royco.markets
      .flatMap((market) => market.tranches)
      .map((tranche) => tranche.pharosStablecoinId)
      .filter((id): id is string => Boolean(id)),
  ),
];
const pharos = await loadPharosUnderlyings(requiredIds, []);
const underlyings = pharos.underlyings.length > 0 ? pharos.underlyings : UNDERLYING_FIXTURES;
const snapshot = buildSnapshot(now, royco.markets, underlyings, { collectedAt: now, pharosFetchedAt: now, publishedAt: now });
const rows = [...snapshot.tranches].sort((a, b) => (b.safetyScore ?? -1) - (a.safetyScore ?? -1));

const pad = (value: unknown, width: number) => String(value ?? "").padEnd(width).slice(0, width);
const padNum = (value: number | null, width: number, digits = 1) => (value == null ? "NR" : value.toFixed(digits)).padStart(width);

console.log(`RoycoPharos calibration — ${METHODOLOGY_VERSION}`);
console.log(`royco mode: ${royco.mode} · pharos mode: ${pharos.mode} · tranches: ${rows.length}`);
console.log(`haircut caps senior/junior ${HAIRCUT_CAP.senior}/${HAIRCUT_CAP.junior}`);
console.log(`safety bands ${SAFETY_BANDS.map((b) => `${b.grade}>=${b.min}`).join(" ")}`);
console.log(`opportunity bands (netYield %) ${OPPORTUNITY_BANDS.map((b) => `${b.grade}>=${b.min}`).join(" ")}\n`);

console.log(
  pad("Market", 22) +
    pad("Side", 7) +
    pad("Underlying", 15) +
    "base".padStart(5) +
    "exp".padStart(5) +
    "str".padStart(5) +
    "hair".padStart(6) +
    "saf".padStart(5) +
    " | " +
    "apy".padStart(6) +
    "net".padStart(6) +
    "opp".padStart(5) +
    "  top haircut drivers",
);
console.log("-".repeat(120));

function topDrivers(tranche: RoycoTrancheView) {
  return [...tranche.penaltyBreakdown]
    .filter((r) => r.appliedPenalty > 0)
    .sort((a, b) => b.appliedPenalty - a.appliedPenalty)
    .slice(0, 3)
    .map((r) => `${r.key}(${r.appliedPenalty.toFixed(1)})`)
    .join(", ");
}

for (const t of rows) {
  console.log(
    pad(t.marketName, 22) +
      pad(t.side, 7) +
      pad(t.depositTokenSymbol ?? "unmapped", 15) +
      padNum(t.underlyingSafetyScore, 5, 0) +
      padNum(t.exposureScore, 5, 0) +
      padNum(t.trancheStructureScore, 5, 0) +
      padNum(t.trancheHaircut, 6) +
      padNum(t.safetyScore, 5, 0) +
      " | " +
      padNum(t.apyUsedPct, 6) +
      padNum(t.opportunityYield, 6) +
      padNum(t.opportunityScore, 5, 0) +
      (t.apySource === "7d" ? "*" : t.apySource === "none" ? "!" : " ") +
      " " +
      topDrivers(t),
  );
}
console.log("  (* = APY fell back to 7d, ! = no positive APY used)\n");

const GRADES = ["A", "B", "C", "D", "E", "F", "NR"];
function gradeCounts(grades: (string | null)[]) {
  const counts = new Map<string, number>(GRADES.map((g) => [g, 0]));
  for (const g of grades) counts.set(g ?? "NR", (counts.get(g ?? "NR") ?? 0) + 1);
  return counts;
}

function histogram(title: string, counts: Map<string, number>) {
  console.log(title);
  for (const g of GRADES) {
    const n = counts.get(g) ?? 0;
    if (n === 0 && g === "NR") continue;
    console.log(`  ${g}  ${String(n).padStart(2)}  ${"█".repeat(n)}`);
  }
  console.log("");
}
const safetyCounts = gradeCounts(rows.map((t) => t.safetyGrade));
const opportunityCounts = gradeCounts(rows.map((t) => t.opportunityGrade));
histogram("SAFETY grade distribution:", safetyCounts);
histogram("OPPORTUNITY grade distribution:", opportunityCounts);

const factorTotals = new Map<string, { total: number; hits: number }>();
for (const t of rows) {
  for (const r of t.penaltyBreakdown) {
    const entry = factorTotals.get(r.key) ?? { total: 0, hits: 0 };
    entry.total += r.appliedPenalty;
    if (r.appliedPenalty > 0) entry.hits += 1;
    factorTotals.set(r.key, entry);
  }
}
console.log("Per-factor applied haircut contribution (across all tranches):");
[...factorTotals.entries()]
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([key, { total, hits }]) => console.log(`  ${pad(key, 24)} total ${padNum(total, 7)}   firing on ${hits} tranches`));

console.log("\nAnchor checks:");
let failures = 0;
const check = (label: string, ok: boolean, detail: string) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${label} — ${detail}`);
};
const find = (symbol: string, side: "senior" | "junior") =>
  rows.find((t) => (t.depositTokenSymbol ?? "").toLowerCase() === symbol.toLowerCase() && t.side === side);

const strongestSenior = rows
  .filter((t) => t.side === "senior" && t.safetyScore != null)
  .sort((a, b) => (b.safetyScore ?? 0) - (a.safetyScore ?? 0))[0];
check(
  "Strongest senior reaches A",
  strongestSenior?.safetyGrade === "A",
  `${strongestSenior?.depositTokenSymbol ?? "?"} senior safety ${strongestSenior?.safetyScore ?? "?"} (${strongestSenior?.safetyGrade ?? "?"})`,
);
// autoUSD: modest base, thick Junior buffer -> Senior cushion credit lifts it above the Pharos score.
const autoSenior = find("autoUSD", "senior");
check(
  "Buffered senior can exceed whole-vault Pharos score",
  autoSenior?.safetyScore != null && autoSenior.underlyingSafetyScore != null && autoSenior.safetyScore > autoSenior.underlyingSafetyScore,
  `autoUSD senior base ${autoSenior?.underlyingSafetyScore ?? "?"} -> safety ${autoSenior?.safetyScore ?? "?"}`,
);

const weakJuniors = rows.filter((t) => t.side === "junior" && (t.underlyingSafetyScore ?? 100) <= 40);
check(
  // First-loss seats on weak base assets belong in the bottom bands; E and F are both honest there.
  "Weak-base juniors land bottom bands (E/F)",
  weakJuniors.length > 0 && weakJuniors.every((t) => t.safetyGrade === "E" || t.safetyGrade === "F"),
  weakJuniors.map((t) => `${t.depositTokenSymbol} ${t.safetyScore}(${t.safetyGrade})`).join(", ") || "none",
);

let inversions = 0;
const inversionMarkets: string[] = [];
for (const market of snapshot.markets) {
  const sen = market.tranches.find((t) => t.side === "senior");
  const jun = market.tranches.find((t) => t.side === "junior");
  if (sen?.safetyScore != null && jun?.safetyScore != null && jun.safetyScore > sen.safetyScore) {
    inversions += 1;
    inversionMarkets.push(market.name);
  }
}
check("No junior outranks its senior on Safety", inversions === 0, inversions === 0 ? "none" : inversionMarkets.join(", "));

const distinctSafety = new Set(rows.map((t) => t.safetyGrade).filter((g) => g && g !== "NR"));
const maxBucket = Math.max(...GRADES.map((g) => rows.filter((t) => t.safetyGrade === g).length));
check("Safety distribution spreads", distinctSafety.size >= 4 && maxBucket <= Math.ceil(rows.length / 2), `${distinctSafety.size} distinct grades, largest bucket ${maxBucket}/${rows.length}`);
const topSafetyGrade =
  GRADES.filter((g) => g !== "NR").sort((a, b) => (safetyCounts.get(b) ?? 0) - (safetyCounts.get(a) ?? 0))[0] ?? "NR";
check(
  // On real Pharos base scores the direct-tranche book legitimately centers on D/E (first-loss
  // and thin seats on F/D base assets). The guard is against a pathological collapse into the
  // single worst band, not against an honest mid-low skew — the "distribution spreads" check above
  // already bounds any single bucket to half the book.
  "Safety mode is not the worst band (F)",
  topSafetyGrade !== "F",
  `${topSafetyGrade} is largest with ${safetyCounts.get(topSafetyGrade) ?? 0}/${rows.length}`,
);

const rank = (g: string | null) => ({ A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 } as Record<string, number>)[g ?? ""] ?? 0;
const divergent = rows.filter((t) => rank(t.opportunityGrade) - rank(t.safetyGrade) >= 2);
check(
  "Opportunity diverges from Safety (yield pays for risk)",
  divergent.length >= 1,
  divergent.length > 0 ? divergent.map((t) => `${t.depositTokenSymbol} ${t.side} saf ${t.safetyGrade}→opp ${t.opportunityGrade}`).slice(0, 3).join("; ") : "none",
);

console.log(`\n${failures === 0 ? "✓ all anchors passed" : `✗ ${failures} anchor(s) failed`}`);
process.exitCode = failures === 0 ? 0 : 1;
