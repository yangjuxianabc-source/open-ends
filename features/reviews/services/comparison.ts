import { sha256Hex, stableStringify } from "@/lib/crypto/hash";
import type { StoreData } from "@/lib/storage/migrate";
import type { PeriodSnapshot } from "@/types";

export interface ReviewHistoryEntry {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  sourceHash: string;
  facts: unknown;
}

export interface ReviewComparisonContext {
  schemaVersion: 1;
  type: PeriodSnapshot["periodType"];
  previous: ReviewHistoryEntry[];
  monthlyTrajectory: ReviewHistoryEntry[];
  previousYear?: ReviewHistoryEntry;
  longTermBaseline: ReviewHistoryEntry[];
}

export interface ReviewGenerationInput {
  current: ReviewHistoryEntry;
  comparison: ReviewComparisonContext;
}

export function buildReviewGenerationInput(data: StoreData, snapshot: PeriodSnapshot): ReviewGenerationInput {
  const latest = latestSnapshots(data.periodSnapshots);
  const previous = snapshot.periodType === "weekly"
    ? latest.filter(item => item.periodType === "weekly" && item.periodEnd < snapshot.periodStart).sort(byEndDesc).slice(0, 4).reverse().map(entry)
    : snapshot.periodType === "monthly"
      ? latest.filter(item => item.periodType === "monthly" && item.periodEnd < snapshot.periodStart).sort(byEndDesc).slice(0, 6).reverse().map(entry)
      : [];
  const year = snapshot.periodStart.slice(0, 4);
  const monthlyTrajectory = snapshot.periodType === "yearly"
    ? latest.filter(item => item.periodType === "monthly" && item.periodStart.startsWith(year) && item.periodEnd <= snapshot.periodEnd).sort((a,b)=>a.periodStart.localeCompare(b.periodStart)).map(entry)
    : [];
  const previousYear = snapshot.periodType === "yearly"
    ? latest.find(item => item.periodType === "yearly" && item.periodKey === String(Number(year) - 1))
    : undefined;
  return {
    current: entry(snapshot),
    comparison: {
      schemaVersion: 1,
      type: snapshot.periodType,
      previous,
      monthlyTrajectory,
      previousYear: previousYear ? entry(previousYear) : undefined,
      longTermBaseline: snapshot.periodType === "yearly"
        ? latest.filter(item => item.periodType === "yearly" && item.periodEnd < snapshot.periodStart).sort(byEndDesc).slice(0,5).reverse().map(entry)
        : [],
    },
  };
}

export async function reviewInputHash(input: ReviewGenerationInput) {
  return sha256Hex(stableStringify(input));
}

function latestSnapshots(snapshots: PeriodSnapshot[]) {
  const byKey = new Map<string, PeriodSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.periodType}:${snapshot.periodKey}`;
    const current = byKey.get(key);
    if (!current || snapshot.revision > current.revision) byKey.set(key, snapshot);
  }
  return [...byKey.values()];
}

function entry(snapshot: PeriodSnapshot): ReviewHistoryEntry {
  return {
    periodKey: snapshot.periodKey,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    sourceHash: snapshot.sourceHash,
    facts: JSON.parse(snapshot.factsJson) as unknown,
  };
}

function byEndDesc(a: PeriodSnapshot, b: PeriodSnapshot) {
  return b.periodEnd.localeCompare(a.periodEnd);
}
