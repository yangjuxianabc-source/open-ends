import { currentTimeZone, localDateInTimeZone } from "@/lib/dates";
import type { MediaEvent, MediaItem, ReadingEvent, ReadingItem, SparkLink, Task, TaskEvent } from "@/types";
import type { StoreData } from "@/lib/storage/migrate";
import { reconcileSparkStatus } from "./lifecycle";
import type { SparkDraftItem, SparkMediaCandidate } from "../types";

export interface ApplySparkOptions {
  now: string;
  today: string;
  id?: () => string;
}

export interface ApplySparkResult {
  data: StoreData;
  created: { tasks: string[]; readings: string[]; media: string[] };
  skipped: number;
}

export function applySparkDraft(data: StoreData, sparkId: string, analysisId: string, items: SparkDraftItem[], options: ApplySparkOptions): ApplySparkResult {
  const spark = data.sparks.find(item => item.id === sparkId);
  if (!spark) throw new Error("SPARK_NOT_FOUND");
  const analysis = data.sparkAnalysis.find(item => item.id === analysisId && item.sparkId === sparkId);
  if (!analysis) throw new Error("SPARK_ANALYSIS_NOT_FOUND");
  const currentRevision = data.sparkRevisions.filter(item => item.sparkId === sparkId).sort((a, b) => b.revision - a.revision)[0];
  if (!currentRevision || analysis.sparkRevision !== currentRevision.revision || analysis.sourceHash !== currentRevision.sourceHash) throw new Error("SPARK_ANALYSIS_STALE");
  if (analysis.appliedAt) throw new Error("SPARK_ANALYSIS_ALREADY_APPLIED");
  if (items.some(item => item.enabled && (item.kind === "media" ? !item.query.trim() : !item.title.trim()))) throw new Error("SPARK_EMPTY_TITLE");
  const makeId = options.id ?? (() => crypto.randomUUID());
  const tasks = [...data.tasks];
  const taskEvents = [...data.taskEvents];
  const readingItems = [...data.readingItems];
  const readingEvents = [...data.readingEvents];
  const mediaItems = [...data.mediaItems];
  const mediaEvents = [...data.mediaEvents];
  const sparkLinks = [...data.sparkLinks];
  const created = { tasks: [] as string[], readings: [] as string[], media: [] as string[] };
  let focusTaskId: string | undefined;
  let skipped = 0;

  for (const item of items) {
    if (!item.enabled) {
      skipped += 1;
      continue;
    }
    if (item.kind === "ambiguous") throw new Error("SPARK_AMBIGUOUS_UNRESOLVED");
    const now = options.now;
    if (item.kind === "task") {
      const taskId = makeId();
      const plannedDate = item.plannedDate ?? (item.timeBucket === "today" ? options.today : undefined);
      const task: Task = { id: taskId, title: item.title.trim(), contextPoints: cleanContext(item.contextPoints), status: "open", domain: item.domain, plannedDate, createdAt: now, updatedAt: now };
      tasks.unshift(task);
      taskEvents.unshift(taskEvent(taskId, "created", now));
      if (plannedDate) taskEvents.unshift(taskEvent(taskId, "scheduled", now, { toDate: plannedDate }));
      sparkLinks.unshift(link(makeId(), sparkId, "task", taskId, now));
      created.tasks.push(taskId);
      if (!focusTaskId && item.focusCandidate && plannedDate === options.today) focusTaskId = taskId;
      continue;
    }
    if (item.kind === "reading") {
      if (item.candidateRequired && !item.candidate) throw new Error("SPARK_READING_CANDIDATE_REQUIRED");
      const readingId = makeId();
      const candidate=item.candidate;
      const cover=candidate?.url?{provider:candidate.provider,externalId:candidate.externalId,url:candidate.url,matchedAt:now}:undefined;
      const reading: ReadingItem = { id: readingId, title: candidate?.title.trim()||item.title.trim(), author:candidate?.authors.filter(Boolean).join("、")||item.author?.trim()||undefined, type: item.readingType, status: "want", cover, createdAt: now, updatedAt: now };
      readingItems.unshift(reading);
      readingEvents.unshift(readingEvent(readingId, "added", now));
      sparkLinks.unshift(link(makeId(), sparkId, "reading", readingId, now));
      created.readings.push(readingId);
      continue;
    }
    if (!item.candidate) throw new Error("SPARK_MEDIA_CANDIDATE_REQUIRED");
    const mediaId = makeId();
    const media: MediaItem = { id: mediaId, ...mediaFromCandidate(item.candidate, now) };
    mediaItems.unshift(media);
    mediaEvents.unshift(mediaEvent(mediaId, "added", now));
    sparkLinks.unshift(link(makeId(), sparkId, "media", mediaId, now));
    created.media.push(mediaId);
  }

  const appliedAt = options.now;
  const next: StoreData = {
    ...data,
    tasks,
    taskEvents,
    readingItems,
    readingEvents,
    mediaItems,
    mediaEvents,
    sparkLinks,
    dailyFocus: focusTaskId ? [{ date: options.today, taskId: focusTaskId, assignedAt: appliedAt }, ...data.dailyFocus.filter(item => item.date !== options.today)] : data.dailyFocus,
    sparkAnalysis: data.sparkAnalysis.map(item => item.id === analysisId ? { ...item, appliedAt } : item),
    sparks: data.sparks.map(item => item.id === sparkId ? { ...item, processedAt: item.processedAt ?? appliedAt } : item),
  };
  return { data: reconcileSparkStatus(next, sparkId, options.now), created, skipped };
}

function cleanContext(points: string[]) {
  return points.map(point => point.trim()).filter(Boolean).slice(0, 5).join("").length <= 180 ? points.map(point => point.trim()).filter(Boolean).slice(0, 5) : points.map(point => point.trim()).filter(Boolean).slice(0, 5).map(point => point.slice(0, 60));
}

function taskEvent(taskId: string, type: TaskEvent["type"], occurredAt: string, extra: Partial<TaskEvent> = {}): TaskEvent {
  const timezone = currentTimeZone();
  return { id: crypto.randomUUID(), taskId, type, occurredAt, localDate: localDateInTimeZone(occurredAt, timezone), timezone, ...extra };
}

function readingEvent(readingItemId: string, type: ReadingEvent["type"], occurredAt: string): ReadingEvent {
  const timezone = currentTimeZone();
  return { id: crypto.randomUUID(), readingItemId, type, occurredAt, localDate: localDateInTimeZone(occurredAt, timezone), timezone };
}

function mediaEvent(mediaItemId: string, type: MediaEvent["type"], occurredAt: string): MediaEvent {
  const timezone = currentTimeZone();
  return { id: crypto.randomUUID(), mediaItemId, type, occurredAt, localDate: localDateInTimeZone(occurredAt, timezone), timezone };
}

function link(id: string, sparkId: string, targetType: SparkLink["targetType"], targetId: string, createdAt: string): SparkLink {
  return { id, sparkId, targetType, targetId, createdAt };
}

function mediaFromCandidate(candidate: SparkMediaCandidate, now: string): Omit<MediaItem, "id"> {
  return { tmdbId: candidate.tmdbId, mediaType: candidate.mediaType, title: candidate.title, originalTitle: candidate.originalTitle, releaseDate: candidate.releaseDate, releaseYear: candidate.releaseYear, posterPath: candidate.posterPath, genreIds: candidate.genreIds, originalLanguage: candidate.originalLanguage, status: "want", createdAt: now, updatedAt: now };
}
