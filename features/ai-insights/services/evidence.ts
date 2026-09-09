import { addDays, fromDateKey, getWeekRange, toDateKey } from "@/lib/dates";
import type { StoreData } from "@/lib/storage/migrate";
import { legacyPreferenceRating, type Rating, type Task, type TaskDomain, type TaskEvent, type TaskStatus } from "@/types";
import { backfilledCompletionEvents, completionEvents, recordId, type RecordLifecycleEvent } from "@/features/reviews/services/record-lifecycle";

export interface Evidence { date: string; kind: string; text: string }
export interface EvidenceDigest { weekStart: string; weekEnd: string; content: string; sourceHash: string; generatedAt: string }

export interface RecordWindowEvidence {
  started: number;
  finished: number;
  backfilledFinished: number;
  dropped: number;
  restarted: number;
  preferenceChanges: number;
  ratedCount: number;
  averageRating: number | null;
  likes: number;
  dislikes: number;
}

export interface ProfileWindowEvidence {
  start: string;
  end: string;
  tasks: { completed: number; dropped: number; rescheduled: number; focusAssigned: number; focusCompleted: number; domains: Record<TaskDomain, number> };
  reading: RecordWindowEvidence;
  media: RecordWindowEvidence;
}

export interface ProfileEvidencePack {
  schemaVersion: 2;
  evidenceEnd: string;
  windows: { last30Days: ProfileWindowEvidence; last90Days: ProfileWindowEvidence; last365Days: ProfileWindowEvidence; allTime: ProfileWindowEvidence };
  focusTrend: Array<{ weekStart: string; assigned: number; completed: number }>;
  rescheduleTrend: Array<{ month: string; count: number }>;
  openTaskAge: Array<{ title: string; ageDays: number; plannedDate?: string }>;
  weeklyRhythm: Record<string, number>;
  monthlyChanges: Array<{ month: string; completed: number; dropped: number; rescheduled: number }>;
  reading: Pick<RecordWindowEvidence, "finished" | "backfilledFinished" | "dropped" | "restarted" | "ratedCount" | "averageRating" | "likes" | "dislikes">;
  media: Pick<RecordWindowEvidence, "finished" | "backfilledFinished" | "dropped" | "restarted" | "ratedCount" | "averageRating" | "likes" | "dislikes">;
  tasteEvidence: { reading: string[]; media: string[] };
  representative: { completedTasks: string[]; openTasks: string[]; reading: string[]; media: string[] };
}

const clean = (value: string | undefined) => value?.trim().replace(/\s+/g, " ");
const DOMAINS: TaskDomain[] = ["work", "study", "creation", "project", "life", "health", "relationship", "reading", "leisure", "other"];
const emptyDomains = (): Record<TaskDomain, number> => Object.fromEntries(DOMAINS.map(domain => [domain, 0])) as Record<TaskDomain, number>;
const inRange = (date: string, start: string, end: string) => date >= start && date <= end;
const unique = (values: string[]) => new Set(values).size;
const eventCount = (events: Array<{ type: string }>, type: string) => events.filter(event => event.type === type).length;

export function canonicalEvidence(data: StoreData): Evidence[] {
  const out: Evidence[] = [];
  const tasks = new Map(data.tasks.map(task => [task.id, task]));
  for (const task of data.tasks) out.push({ date: task.plannedDate ?? task.createdAt.slice(0, 10), kind: "task", text: `任务“${clean(task.title)}”；领域：${task.domain}；状态：${task.status}` });
  for (const event of data.taskEvents) {
    const task = tasks.get(event.taskId);
    out.push({ date: event.localDate, kind: "task_event", text: `任务“${clean(task?.title) ?? "已删除任务"}”发生${event.type}${event.fromDate || event.toDate ? `；日期：${event.fromDate ?? "未排"} → ${event.toDate ?? "未排"}` : ""}` });
  }
  for (const focus of data.dailyFocus) {
    const task = tasks.get(focus.taskId);
    const completedThatDay = data.taskEvents.some(event => event.taskId === focus.taskId && event.type === "completed" && event.localDate === focus.date);
    out.push({ date: focus.date, kind: "daily_focus", text: `Daily Focus：“${clean(task?.title) ?? "已删除任务"}”；当日完成：${completedThatDay ? "是" : "否"}` });
  }
  for (const item of data.readingItems) out.push({ date: item.createdAt.slice(0, 10), kind: "reading", text: `阅读“${clean(item.title)}”${item.author ? `（${clean(item.author)}）` : ""}；状态：${item.status}${tasteText(item.rating, item.preference)}` });
  for (const item of data.mediaItems) out.push({ date: item.createdAt.slice(0, 10), kind: "media", text: `影视“${clean(item.title)}”；状态：${item.status}${tasteText(item.rating, item.preference)}` });
  return out.filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date)).sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.text.localeCompare(b.text));
}

function profileWindow(data: StoreData, start: string, end: string): ProfileWindowEvidence {
  const taskEvents = data.taskEvents.filter(event => inRange(event.localDate, start, end));
  const completedIds = [...new Set(taskEvents.filter(event => event.type === "completed").map(event => event.taskId))];
  const droppedIds = [...new Set(taskEvents.filter(event => event.type === "dropped").map(event => event.taskId))];
  const taskById = new Map(data.tasks.map(task => [task.id, task]));
  const domains = emptyDomains();
  for (const taskId of completedIds) {
    const domain = taskById.get(taskId)?.domain;
    if (domain) domains[domain]++;
  }
  const focus = data.dailyFocus.filter(item => inRange(item.date, start, end));
  const focusCompleted = focus.filter(item => taskEvents.some(event => event.taskId === item.taskId && event.type === "completed" && event.localDate === item.date)).length;
  return {
    start,
    end,
    tasks: { completed: completedIds.length, dropped: droppedIds.length, rescheduled: eventCount(taskEvents, "rescheduled"), focusAssigned: focus.length, focusCompleted, domains },
    reading: recordWindow(data.readingEvents, start, end, event => event.readingItemId),
    media: recordWindow(data.mediaEvents, start, end, event => event.mediaItemId),
  };
}

function recordWindow<T extends RecordLifecycleEvent>(allEvents: readonly T[], start: string, end: string, idOf: (event: T) => string): RecordWindowEvidence {
  const scopedEvents = allEvents.filter(event => inRange(event.localDate, start, end));
  const ratings = scopedEvents.filter(event => event.type === "rating_changed" && typeof event.rating === "number");
  const latestRatings = latestRatingByRecord(ratings, idOf);
  const ratingValues = [...latestRatings.values()];
  const legacyLikes = new Set(scopedEvents.filter(event => event.type === "preference_changed" && event.preference === "like").map(idOf));
  const legacyDislikes = new Set(scopedEvents.filter(event => event.type === "preference_changed" && event.preference === "dislike").map(idOf));
  const positive = new Set([...latestRatings].filter(([, rating]) => rating >= 4).map(([id]) => id));
  const negative = new Set([...latestRatings].filter(([, rating]) => rating <= 2).map(([id]) => id));
  return {
    started: eventCount(scopedEvents, "started"),
    finished: unique(completionEvents(allEvents, start, end).map(idOf)),
    backfilledFinished: unique(backfilledCompletionEvents(allEvents, start, end).map(idOf)),
    dropped: unique(scopedEvents.filter(event => event.type === "dropped").map(idOf)),
    restarted: eventCount(scopedEvents, "restarted"),
    preferenceChanges: eventCount(scopedEvents, "preference_changed"),
    ratedCount: latestRatings.size,
    averageRating: ratingValues.length ? roundRating(ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length) : null,
    likes: new Set([...positive, ...legacyLikes]).size,
    dislikes: new Set([...negative, ...legacyDislikes]).size,
  };
}

function latestRatingByRecord<T extends RecordLifecycleEvent>(events: readonly T[], idOf: (event: T) => string) {
  const latest = new Map<string, number>();
  for (const event of [...events].sort(byOccurredAt)) latest.set(idOf(event), event.rating as number);
  return latest;
}

function tasteText(rating: Rating | undefined, preference: string | undefined) {
  const effective = rating ?? legacyPreferenceRating(preference as Parameters<typeof legacyPreferenceRating>[0]);
  if (effective === undefined) return preference ? `；旧版喜好：${preference}` : "";
  if (effective >= 4) return `；评分：${effective}/5（明确正向喜好）`;
  if (effective <= 2) return `；评分：${effective}/5（明确负向喜好）`;
  return `；评分：${effective}/5（中性，不做强结论）`;
}

function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}

function earliestFactDate(data: StoreData, today: string) {
  const dates = [...data.tasks.map(task => task.createdAt.slice(0, 10)), ...data.taskEvents.map(event => event.localDate), ...data.dailyFocus.map(item => item.date), ...data.readingEvents.map(event => event.localDate), ...data.mediaEvents.map(event => event.localDate)].filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
  return dates[0] ?? today;
}

function monthKey(date: string) { return date.slice(0, 7); }
function monthKeys(today: string) {
  const current = fromDateKey(`${today.slice(0, 7)}-01`);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - 11 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function taskStatusAt(task: Task, events: TaskEvent[], end: string): TaskStatus {
  const terminal = [...events].filter(event => event.taskId === task.id && event.localDate <= end && ["completed", "dropped", "restored"].includes(event.type)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).at(-1);
  if (terminal?.type === "completed") return "done";
  if (terminal?.type === "dropped") return "dropped";
  if (terminal?.type === "restored") return "open";
  return task.updatedAt.slice(0, 10) <= end ? task.status : "open";
}

function taskPlannedDateAt(task: Task, events: TaskEvent[], end: string) {
  const schedule = [...events].filter(event => event.taskId === task.id && event.localDate <= end && ["scheduled", "rescheduled"].includes(event.type)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).at(-1);
  if (schedule) return schedule.toDate;
  return task.updatedAt.slice(0, 10) <= end ? task.plannedDate : undefined;
}

function dataThrough(data: StoreData, end: string): StoreData {
  const taskEvents = data.taskEvents.filter(event => event.localDate <= end);
  return {
    ...data,
    tasks: data.tasks.filter(task => task.createdAt.slice(0, 10) <= end).map(task => ({ ...task, status: taskStatusAt(task, taskEvents, end), plannedDate: taskPlannedDateAt(task, taskEvents, end) })),
    taskEvents,
    dailyFocus: data.dailyFocus.filter(item => item.date <= end),
    readingItems: data.readingItems.filter(item => item.createdAt.slice(0, 10) <= end),
    readingEvents: data.readingEvents.filter(event => event.localDate <= end),
    mediaItems: data.mediaItems.filter(item => item.createdAt.slice(0, 10) <= end),
    mediaEvents: data.mediaEvents.filter(event => event.localDate <= end),
    periodSnapshots: data.periodSnapshots.filter(item => item.periodEnd <= end),
    aiReviews: data.aiReviews.filter(item => item.generatedAt.slice(0, 10) <= end),
    profileSnapshots: data.profileSnapshots.filter(item => item.evidenceEnd <= end),
  };
}

export function buildProfileEvidencePack(data: StoreData, today: string): ProfileEvidencePack {
  data = dataThrough(data, today);
  const endDate = fromDateKey(today);
  const allStart = earliestFactDate(data, today);
  const window = (days: number) => toDateKey(addDays(endDate, -(days - 1)));
  const windows = { last30Days: profileWindow(data, window(30), today), last90Days: profileWindow(data, window(90), today), last365Days: profileWindow(data, window(365), today), allTime: profileWindow(data, allStart, today) };
  const focusTrend = Array.from({ length: 12 }, (_, index) => {
    const weekStart = toDateKey(addDays(endDate, -(11 - index) * 7 - 6));
    const weekEnd = toDateKey(addDays(fromDateKey(weekStart), 6));
    const focus = data.dailyFocus.filter(item => inRange(item.date, weekStart, weekEnd));
    return { weekStart, assigned: focus.length, completed: focus.filter(item => data.taskEvents.some(event => event.taskId === item.taskId && event.type === "completed" && event.localDate === item.date)).length };
  });
  const rescheduleTrend = monthKeys(today).map(month => ({ month, count: data.taskEvents.filter(event => event.type === "rescheduled" && monthKey(event.localDate) === month).length }));
  const openTaskAge = data.tasks.filter(task => task.status === "open").map(task => ({ title: clean(task.title) ?? "未命名任务", ageDays: Math.max(0, Math.round((endDate.getTime() - fromDateKey(task.createdAt.slice(0, 10)).getTime()) / 86400000)), plannedDate: task.plannedDate })).sort((a, b) => b.ageDays - a.ageDays || a.title.localeCompare(b.title)).slice(0, 8);
  const rhythm: Record<string, number> = { 周一: 0, 周二: 0, 周三: 0, 周四: 0, 周五: 0, 周六: 0, 周日: 0 };
  const rhythmLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  for (const event of data.taskEvents.filter(item => item.localDate <= today && ["completed", "rescheduled"].includes(item.type))) rhythm[rhythmLabels[fromDateKey(event.localDate).getDay()]]++;
  const monthlyChanges = monthKeys(today).map(month => {
    const events = data.taskEvents.filter(event => monthKey(event.localDate) === month);
    return { month, completed: unique(events.filter(event => event.type === "completed").map(event => event.taskId)), dropped: unique(events.filter(event => event.type === "dropped").map(event => event.taskId)), rescheduled: eventCount(events, "rescheduled") };
  });
  const taskById = new Map(data.tasks.map(task => [task.id, task]));
  const completedTaskIds = [...new Set(data.taskEvents.filter(event => event.localDate <= today && event.type === "completed").sort(byOccurredAtDesc).map(event => event.taskId))];
  const completedTasks = completedTaskIds.map(id => clean(taskById.get(id)?.title)).filter((value): value is string => Boolean(value)).slice(0, 8);
  const openTasks = openTaskAge.map(item => item.title);
  const readingById = new Map(data.readingItems.map(item => [item.id, item]));
  const mediaById = new Map(data.mediaItems.map(item => [item.id, item]));
  const reading = [...new Set(completionEvents(data.readingEvents).sort(byOccurredAtDesc).map(event => clean(readingById.get(recordId(event))?.title)).filter((value): value is string => Boolean(value)))].slice(0, 6);
  const media = [...new Set(completionEvents(data.mediaEvents).sort(byOccurredAtDesc).map(event => clean(mediaById.get(recordId(event))?.title)).filter((value): value is string => Boolean(value)))].slice(0, 6);
  const tasteEvidence = {
    reading: data.readingItems.filter(item => item.rating !== undefined && (item.rating >= 4 || item.rating <= 2)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8).map(item => `《${clean(item.title)}》${tasteText(item.rating, item.preference)}`),
    media: data.mediaItems.filter(item => item.rating !== undefined && (item.rating >= 4 || item.rating <= 2)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8).map(item => `${clean(item.title)}${tasteText(item.rating, item.preference)}`),
  };
  return {
    schemaVersion: 2,
    evidenceEnd: today,
    windows,
    focusTrend,
    rescheduleTrend,
    openTaskAge,
    weeklyRhythm: rhythm,
    monthlyChanges,
    reading: pickRecordSummary(windows.allTime.reading),
    media: pickRecordSummary(windows.allTime.media),
    tasteEvidence,
    representative: { completedTasks, openTasks, reading, media },
  };
}

function pickRecordSummary(summary: RecordWindowEvidence): ProfileEvidencePack["reading"] {
  const { finished, backfilledFinished, dropped, restarted, ratedCount, averageRating, likes, dislikes } = summary;
  return { finished, backfilledFinished, dropped, restarted, ratedCount, averageRating, likes, dislikes };
}

const byOccurredAt = <T extends { occurredAt: string; id: string }>(a: T, b: T) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id);
const byOccurredAtDesc = <T extends { occurredAt: string; id: string }>(a: T, b: T) => byOccurredAt(b, a);

export function evidenceHash(items: Evidence[]) { let hash = 2166136261; for (const char of JSON.stringify(items)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, "0"); }
export function buildWeekDigests(items: Evidence[]): EvidenceDigest[] { const groups = new Map<string, Evidence[]>(); for (const item of items) { const range = getWeekRange(fromDateKey(item.date)); groups.set(range.start, [...(groups.get(range.start) ?? []), item]); } return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, values]) => ({ weekStart, weekEnd: toDateKey(addDays(fromDateKey(weekStart), 6)), sourceHash: evidenceHash(values), generatedAt: new Date().toISOString(), content: values.map(item => `${item.date} [${item.kind}] ${item.text}`).join("\n") })); }
export function reconcileWeekDigests(next: EvidenceDigest[], previous: EvidenceDigest[]) { return next.map(value => previous.find(old => old.weekStart === value.weekStart && old.sourceHash === value.sourceHash) ?? value); }
export const evidenceThrough = (items: Evidence[], end: string) => items.filter(item => item.date <= end);
export const evidenceIn = (items: Evidence[], start: string, end: string) => items.filter(item => item.date >= start && item.date <= end);
