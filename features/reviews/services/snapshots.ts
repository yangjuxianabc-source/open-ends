import { addDays, fromDateKey, isDateInRange, monthRange, toDateKey, yearRange } from "@/lib/dates";
import { sha256Hex, stableStringify } from "@/lib/crypto/hash";
import { periodTaskStats } from "@/lib/stats";
import type { PeriodSnapshot, PeriodType, TaskDomain } from "@/types";
import type { StoreData } from "@/lib/storage/migrate";
import { classifyRecordCompletion, recordId, type RecordLifecycleEvent } from "./record-lifecycle";

export interface SnapshotDraft {
  periodType: PeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  sourceHash: string;
  factsJson: string;
}

export async function buildWeeklySnapshot(data: StoreData, weekStart: string) {
  return buildPeriodSnapshot(data, "weekly", weekStart, toDateKey(addDays(fromDateKey(weekStart), 6)), weekStart);
}

export async function buildMonthlySnapshot(data: StoreData, year: number, month: number) {
  const range = monthRange(year, month);
  return buildPeriodSnapshot(data, "monthly", range.start, range.end, `${year}-${String(month + 1).padStart(2, "0")}`);
}

export async function buildYearlySnapshot(data: StoreData, year: number) {
  const range = yearRange(year);
  return buildPeriodSnapshot(data, "yearly", range.start, range.end, String(year));
}

export async function buildPeriodSnapshot(
  data: StoreData,
  periodType: PeriodType,
  periodStart: string,
  periodEnd: string,
  periodKey: string,
): Promise<SnapshotDraft> {
  const taskEvents = data.taskEvents.filter(event => isDateInRange(event.localDate, periodStart, periodEnd) || (event.fromDate && isDateInRange(event.fromDate, periodStart, periodEnd)) || (event.toDate && isDateInRange(event.toDate, periodStart, periodEnd)));
  const taskIds = new Set(taskEvents.map(event => event.taskId));
  for (const task of data.tasks) if (task.plannedDate && isDateInRange(task.plannedDate, periodStart, periodEnd)) taskIds.add(task.id);
  const tasks = data.tasks.filter(task => taskIds.has(task.id)).sort(byId);
  const dailyFocus = data.dailyFocus.filter(focus => isDateInRange(focus.date, periodStart, periodEnd)).sort((a, b) => a.date.localeCompare(b.date));
  const readingEvents = data.readingEvents.filter(event => isDateInRange(event.localDate, periodStart, periodEnd)).sort(byOccurredAt);
  const mediaEvents = data.mediaEvents.filter(event => isDateInRange(event.localDate, periodStart, periodEnd)).sort(byOccurredAt);
  const stats = periodTaskStats(data.tasks, data.taskEvents, data.dailyFocus, periodStart, periodEnd);
  const taskById = new Map(data.tasks.map(task => [task.id, task]));
  const completedItems = [...new Set(taskEvents.filter(event => event.type === "completed").map(event => event.taskId))].map(taskId => {
    const task = taskById.get(taskId);
    return task ? { title: task.title, domain: task.domain } : undefined;
  }).filter((item): item is { title: string; domain: TaskDomain } => Boolean(item)).sort((a, b) => a.title.localeCompare(b.title));
  const rescheduledItems = taskEvents.filter(event => event.type === "rescheduled").map(event => ({ title: taskById.get(event.taskId)?.title ?? "已删除任务", fromDate: event.fromDate ?? null, toDate: event.toDate ?? null }));
  const droppedItems = [...new Set(taskEvents.filter(event => event.type === "dropped").map(event => event.taskId))].map(taskId => taskById.get(taskId)?.title ?? "已删除任务").sort();
  const readingById = new Map(data.readingItems.map(item => [item.id, item]));
  const mediaById = new Map(data.mediaItems.map(item => [item.id, item]));
  const readingSummary = recordSummary(data.readingEvents, readingEvents, event => event.readingItemId, readingById);
  const mediaSummary = recordSummary(data.mediaEvents, mediaEvents, event => event.mediaItemId, mediaById);
  const facts = {
    schemaVersion: 2,
    periodType,
    periodKey,
    periodStart,
    periodEnd,
    tasks: { completed: stats.done, rescheduled: stats.rescheduled, dropped: stats.dropped, domains: stats.domains, completedItems, rescheduledItems, droppedItems },
    focus: stats.focus,
    reading: { ...readingSummary, events: readingEvents.map(event => recordEvent(event, readingById, data.readingEvents)) },
    media: { ...mediaSummary, events: mediaEvents.map(event => recordEvent(event, mediaById, data.mediaEvents)) },
  };
  const source = { tasks, taskEvents: [...taskEvents].sort(byOccurredAt), dailyFocus, readingEvents, mediaEvents };
  return { periodType, periodKey, periodStart, periodEnd, factsJson: stableStringify(facts), sourceHash: await sha256Hex(stableStringify(source)) };
}

export function createSnapshotRevision(draft: SnapshotDraft, existing: PeriodSnapshot[], id: string, createdAt: string): PeriodSnapshot | null {
  const revisions = existing.filter(item => item.periodType === draft.periodType && item.periodKey === draft.periodKey).sort((a, b) => b.revision - a.revision);
  const latest = revisions[0];
  if (latest?.sourceHash === draft.sourceHash) return null;
  return { ...draft, id, revision: (latest?.revision ?? 0) + 1, createdAt, supersedesId: latest?.id };
}

function recordSummary<T extends RecordLifecycleEvent, Value extends { title?: string }>(
  allEvents: readonly T[],
  periodEvents: readonly T[],
  idOf: (event: T) => string,
  items: Map<string, Value>,
) {
  const scopedLifecycle = periodEvents.filter(event => event.type === "finished" && classifyRecordCompletion(allEvents, event) === "lifecycle");
  const scopedBackfills = periodEvents.filter(event => event.type === "finished" && classifyRecordCompletion(allEvents, event) === "backfill");
  const ratings = periodEvents.filter(event => event.type === "rating_changed" && typeof event.rating === "number");
  const latestRatings = new Map<string, number>();
  for (const event of [...ratings].sort(byOccurredAt)) latestRatings.set(idOf(event), event.rating as number);
  const ratingValues = [...latestRatings.values()];
  const positive = [...latestRatings].filter(([, rating]) => rating >= 4).map(([id]) => cleanItemLabel(items.get(id))).filter((value): value is string => Boolean(value));
  const negative = [...latestRatings].filter(([, rating]) => rating <= 2).map(([id]) => cleanItemLabel(items.get(id))).filter((value): value is string => Boolean(value));
  return {
    finished: new Set(scopedLifecycle.map(idOf)).size,
    backfilledFinished: new Set(scopedBackfills.map(idOf)).size,
    restarted: periodEvents.filter(event => event.type === "restarted").length,
    ratedCount: latestRatings.size,
    averageRating: ratingValues.length ? Math.round(ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length * 10) / 10 : null,
    positiveRatedItems: positive,
    negativeRatedItems: negative,
    preferenceChanges: periodEvents.filter(event => event.type === "preference_changed").length,
  };
}

function recordEvent<T extends RecordLifecycleEvent, Value>(event: T, items: Map<string, Value>, allEvents: readonly T[]) {
  const id = recordId(event);
  const item = items.get(id) as (Value & { title?: string; author?: string; mediaType?: string }) | undefined;
  return {
    date: event.localDate,
    type: event.type,
    title: item?.title ?? ("readingItemId" in event ? "已移除的阅读记录" : "已移除的影视记录"),
    ...(item && "author" in item ? { author: item.author ?? null } : {}),
    ...(item && "mediaType" in item ? { mediaType: item.mediaType ?? null } : {}),
    preference: event.preference ?? null,
    rating: event.rating ?? null,
    ...(event.type === "finished" ? { completionKind: classifyRecordCompletion(allEvents, event) } : {}),
  };
}

function cleanItemLabel(item: { title?: string } | undefined) {
  return item?.title?.trim().replace(/\s+/g, " ");
}

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
const byOccurredAt = <T extends { occurredAt: string; id: string }>(a: T, b: T) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id);
