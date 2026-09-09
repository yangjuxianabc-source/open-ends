import { buildProfileEvidencePack, type ProfileEvidencePack } from "@/features/ai-insights/services/evidence";
import { latestProfile } from "@/features/ai-insights/services/generation";
import { isReviewStale } from "@/features/reviews/services/generation";
import { getWeekRange, isDateInRange, monthRange, yearRange } from "@/lib/dates";
import { periodTaskStats } from "@/lib/stats";
import { classifyRecordCompletion } from "@/features/reviews/services/record-lifecycle";
import type { StoreData } from "@/lib/storage/migrate";
import type { AIReview, PeriodSnapshot, PeriodType, ProfileSnapshot, TaskDomain } from "@/types";

export interface PeriodDescriptor {
  type: ReviewPeriod;
  key: string;
  start: string;
  end: string;
  title: string;
}

export interface ReviewRecordFact {
  scope: "reading" | "media";
  kind: string;
  title: string;
  date: string;
  occurredAt: string;
}

export type ReviewPeriod = "weekly" | "monthly" | "yearly";
export type ReviewView = "facts" | "summary" | "profile";

export interface ReviewTransitionFact {
  kind: string;
  title: string;
  note: string;
}

export interface ReviewViewModel {
  descriptor: PeriodDescriptor;
  currentDescriptor: PeriodDescriptor;
  snapshot?: PeriodSnapshot;
  review?: AIReview;
  stale: boolean;
  stats: ReturnType<typeof periodTaskStats>;
  domains: Array<[TaskDomain, number]>;
  recordFacts: ReviewRecordFact[];
  transitionFacts: ReviewTransitionFact[];
  isCurrent: boolean;
  canNext: boolean;
}

export interface ProfileViewModel {
  profile?: ProfileSnapshot;
  pack: ProfileEvidencePack;
  last90Days: ProfileEvidencePack["windows"]["last90Days"];
}

export function buildPeriodDescriptor(type: ReviewPeriod, anchor: Date): PeriodDescriptor {
  if (type === "weekly") {
    const range = getWeekRange(anchor);
    return { type, key: range.start, start: range.start, end: range.end, title: "本周生活切片" };
  }
  if (type === "monthly") {
    const range = monthRange(anchor.getFullYear(), anchor.getMonth());
    return { type, key: `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`, start: range.start, end: range.end, title: "本月生活切片" };
  }
  const range = yearRange(anchor.getFullYear());
  return { type, key: String(anchor.getFullYear()), start: range.start, end: range.end, title: "这一年生活切片" };
}

export function buildReviewViewModel(data: StoreData, descriptor: PeriodDescriptor, currentDescriptor = buildPeriodDescriptor(descriptor.type, new Date()), currentInputHash?:string): ReviewViewModel {
  const snapshot = latestSnapshot(data, descriptor.type, descriptor.key);
  const review = latestReviewForPeriod(data, descriptor.type, descriptor.key);
  const stats = periodTaskStats(data.tasks, data.taskEvents, data.dailyFocus, descriptor.start, descriptor.end);
  const domains = Object.entries(stats.domains).filter(([, value]) => value > 0) as Array<[TaskDomain, number]>;
  return {
    descriptor,
    currentDescriptor,
    snapshot,
    review,
    stale: isReviewStale(review, currentInputHash),
    stats,
    domains,
    recordFacts: buildRecordFacts(data, descriptor.start, descriptor.end).slice(0, 5),
    transitionFacts: buildTransitionFacts(data, descriptor.start, descriptor.end).slice(0, 5),
    isCurrent: descriptor.key === currentDescriptor.key,
    canNext: descriptor.key < currentDescriptor.key,
  };
}

export function buildProfileViewModel(data: StoreData, today: string): ProfileViewModel {
  const pack = buildProfileEvidencePack(data, today);
  return { profile: latestProfile(data.profileSnapshots), pack, last90Days: pack.windows.last90Days };
}

export function buildArchiveViewModel(data: StoreData) {
  return {
    readingItems: [...data.readingItems],
    readingEvents: [...data.readingEvents],
    mediaItems: [...data.mediaItems],
    mediaEvents: [...data.mediaEvents],
    sparks: [...data.sparks],
    sparkAnalysis: [...data.sparkAnalysis],
    sparkLinks: [...data.sparkLinks],
    completedTasks: data.tasks.filter(task => task.status === "done"),
    droppedTasks: data.tasks.filter(task => task.status === "dropped"),
    historicalDailyFocus: [...data.dailyFocus].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function latestSnapshot(data: StoreData, type: PeriodType, key: string) {
  return data.periodSnapshots.filter(item => item.periodType === type && item.periodKey === key).sort((a, b) => b.revision - a.revision)[0];
}

function latestReviewForPeriod(data: StoreData, type: PeriodType, key: string) {
  const snapshotIds = new Set(data.periodSnapshots.filter(item => item.periodType === type && item.periodKey === key).map(item => item.id));
  return data.aiReviews.filter(item => item.reviewType === type && snapshotIds.has(item.snapshotId)).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.revision - a.revision)[0];
}

function buildRecordFacts(data: StoreData, start: string, end: string): ReviewRecordFact[] {
  const readingById = new Map(data.readingItems.map(item => [item.id, item]));
  const mediaById = new Map(data.mediaItems.map(item => [item.id, item]));
  const included = new Set(["started", "finished", "dropped", "restarted", "preference_changed", "rating_changed"]);
  const reading = data.readingEvents.filter(event => included.has(event.type) && isDateInRange(event.localDate, start, end) && (event.type !== "finished" || classifyRecordCompletion(data.readingEvents, event) === "lifecycle")).map(event => ({ scope: "reading" as const, kind: recordEventLabel(event.type, "阅读", event.preference, event.rating), title: readingById.get(event.readingItemId)?.title ?? "已移除的阅读记录", date: event.localDate, occurredAt: event.occurredAt }));
  const media = data.mediaEvents.filter(event => included.has(event.type) && isDateInRange(event.localDate, start, end) && (event.type !== "finished" || classifyRecordCompletion(data.mediaEvents, event) === "lifecycle")).map(event => ({ scope: "media" as const, kind: recordEventLabel(event.type, "影视", event.preference, event.rating), title: mediaById.get(event.mediaItemId)?.title ?? "已移除的影视记录", date: event.localDate, occurredAt: event.occurredAt }));
  return [...reading, ...media].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function buildTransitionFacts(data: StoreData, start: string, end: string): ReviewTransitionFact[] {
  const periodEvents = data.taskEvents.filter(event => isDateInRange(event.localDate, start, end));
  const taskById = new Map(data.tasks.map(task => [task.id, task]));
  const repeated = new Map<string, number>();
  for (const event of periodEvents) if (event.type === "rescheduled") repeated.set(event.taskId, (repeated.get(event.taskId) ?? 0) + 1);
  const facts: ReviewTransitionFact[] = [...repeated].filter(([, count]) => count >= 2).map(([taskId, count]) => ({ kind: "反复延期", title: taskById.get(taskId)?.title ?? "已删除任务", note: `${count} 次` }));
  facts.push(...[...new Set(periodEvents.filter(event => event.type === "dropped").map(event => event.taskId))].map(taskId => ({ kind: "主动放下", title: taskById.get(taskId)?.title ?? "已删除任务", note: "本周期" })));
  const carried = data.tasks.filter(task => task.plannedDate && task.plannedDate < start && task.createdAt.slice(0, 10) < start && wasOpenAtBoundary(data, task.id, start)).slice(0, 5).map(task => ({ kind: "从前一周期延续", title: task.title, note: task.plannedDate ?? "" }));
  return [...carried, ...facts];
}

function wasOpenAtBoundary(data: StoreData, taskId: string, boundary: string) {
  const events = data.taskEvents.filter(event => event.taskId === taskId && event.localDate < boundary && ["created", "completed", "dropped", "restored"].includes(event.type)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const last = events[events.length - 1];
  return !last || last.type === "created" || last.type === "restored";
}

function recordEventLabel(type: string, scope: "阅读" | "影视", preference?: string, rating?: number) {
  if (type === "finished") return `完成${scope}`;
  if (type === "dropped") return `放下${scope}`;
  if (type === "restarted") return scope === "阅读" ? "重新阅读" : "重新观看";
  if (type === "preference_changed") return preference === "like" ? `喜欢${scope}` : `更新${scope}喜好`;
  if (type === "rating_changed") return rating === undefined ? `清除${scope}评分` : `评分${scope} ${rating}/5`;
  return scope === "阅读" ? "开始阅读" : "开始观看";
}
