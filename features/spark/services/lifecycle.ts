import type { SparkLink, SparkTargetType } from "@/types";
import type { StoreData } from "@/lib/storage/migrate";

const terminalStatuses: Record<SparkTargetType, ReadonlySet<string>> = {
  task: new Set(["done", "dropped"]),
  reading: new Set(["finished", "dropped"]),
  media: new Set(["finished", "dropped"]),
};

export interface SparkProgress {
  total: number;
  settled: number;
  missing: number;
}

export function sparkProgress(data: StoreData, sparkId: string): SparkProgress {
  const links = data.sparkLinks.filter(link => link.sparkId === sparkId);
  let settled = 0;
  let missing = 0;
  for (const link of links) {
    const target = targetStatus(data, link);
    if (target === undefined) missing += 1;
    else if (terminalStatuses[link.targetType].has(target)) settled += 1;
  }
  return { total: links.length, settled, missing };
}

export function reconcileSparkStatus(data: StoreData, sparkId: string, now: string): StoreData {
  const spark = data.sparks.find(item => item.id === sparkId);
  if (!spark || spark.status === "archived") return data;
  const progress = sparkProgress(data, sparkId);
  const nextStatus = progress.total > 0 && progress.missing === 0 && progress.settled === progress.total ? "settled" : progress.total > 0 ? "organized" : "inbox";
  const nextSettledAt = nextStatus === "settled" ? spark.settledAt ?? now : undefined;
  if (spark.status === nextStatus && spark.settledAt === nextSettledAt) return data;
  return { ...data, sparks: data.sparks.map(item => item.id === sparkId ? { ...item, status: nextStatus, settledAt: nextSettledAt } : item) };
}

export function reconcileLinkedSparks(data: StoreData, targetType: SparkTargetType, targetId: string, now: string): StoreData {
  const sparkIds = new Set(data.sparkLinks.filter(link => link.targetType === targetType && link.targetId === targetId).map(link => link.sparkId));
  let next = data;
  for (const sparkId of sparkIds) next = reconcileSparkStatus(next, sparkId, now);
  return next;
}

export function linkedSparkIds(data: StoreData, targetType: SparkTargetType, targetId: string): string[] {
  return [...new Set(data.sparkLinks.filter(link => link.targetType === targetType && link.targetId === targetId).map(link => link.sparkId))];
}

function targetStatus(data: StoreData, link: SparkLink): string | undefined {
  if (link.targetType === "task") return data.tasks.find(item => item.id === link.targetId)?.status;
  if (link.targetType === "reading") return data.readingItems.find(item => item.id === link.targetId)?.status;
  return data.mediaItems.find(item => item.id === link.targetId)?.status;
}
