export type TaskStatus = "open" | "done" | "dropped";

export type TaskDomain =
  | "work"
  | "study"
  | "creation"
  | "project"
  | "life"
  | "health"
  | "relationship"
  | "reading"
  | "leisure"
  | "other";

export interface Task {
  id: string;
  title: string;
  contextPoints: string[];
  status: TaskStatus;
  domain: TaskDomain;
  plannedDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  droppedAt?: string;
}

export type TaskEventType =
  | "created"
  | "scheduled"
  | "rescheduled"
  | "completed"
  | "restored"
  | "dropped";

export interface TaskEvent {
  id: string;
  taskId: string;
  type: TaskEventType;
  occurredAt: string;
  localDate: string;
  timezone: string;
  fromDate?: string;
  toDate?: string;
  metadata?: Record<string, unknown>;
}

export interface DailyFocus {
  date: string;
  taskId: string;
  assignedAt: string;
}

export type Preference = "dislike" | "neutral" | "like";
export type Rating = number;

export function isValidRating(value: unknown): value is Rating {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

export function legacyPreferenceRating(preference: Preference | undefined): Rating | undefined {
  if (preference === "dislike") return 1;
  if (preference === "neutral") return 3;
  if (preference === "like") return 5;
  return undefined;
}

export type ReadingStatus = "want" | "reading" | "finished" | "paused" | "dropped";
export type ReadingType = "book" | "article" | "paper" | "other";
export type ReadingEventType =
  | "added"
  | "started"
  | "finished"
  | "paused"
  | "resumed"
  | "dropped"
  | "restarted"
  | "preference_changed"
  | "rating_changed";

export interface ReadingCover {
  provider: "google" | "openlibrary";
  externalId: string;
  url: string;
  matchedAt: string;
}

export interface ReadingItem {
  id: string;
  title: string;
  author?: string;
  type: ReadingType;
  status: ReadingStatus;
  preference?: Preference;
  rating?: Rating;
  cover?: ReadingCover;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingEvent {
  id: string;
  readingItemId: string;
  type: ReadingEventType;
  preference?: Preference;
  rating?: Rating;
  occurredAt: string;
  localDate: string;
  timezone: string;
}

export type MediaStatus = "want" | "watching" | "finished" | "paused" | "dropped";
export type MediaType = "movie" | "tv";
export type MediaEventType = ReadingEventType;

export interface MediaCandidate {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  releaseYear?: number;
  posterPath?: string;
  genreIds: number[];
  originalLanguage?: string;
}

export interface MediaItem {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  releaseYear?: number;
  posterPath?: string;
  genreIds: number[];
  originalLanguage?: string;
  status: MediaStatus;
  preference?: Preference;
  rating?: Rating;
  createdAt: string;
  updatedAt: string;
}

export interface MediaEvent {
  id: string;
  mediaItemId: string;
  type: MediaEventType;
  preference?: Preference;
  rating?: Rating;
  occurredAt: string;
  localDate: string;
  timezone: string;
}

export type SparkStatus = "inbox" | "organized" | "settled" | "archived";
export type SparkTargetType = "task" | "reading" | "media";

export interface Spark {
  id: string;
  content: string;
  status: SparkStatus;
  createdAt: string;
  processedAt?: string;
  settledAt?: string;
  archivedAt?: string;
}

export interface SparkRevision {
  id: string;
  sparkId: string;
  revision: number;
  content: string;
  sourceHash: string;
  createdAt: string;
}

export interface SparkAnalysis {
  id: string;
  sparkId: string;
  sparkRevision: number;
  provider: string;
  model: string;
  sourceHash: string;
  resultJson: string;
  createdAt: string;
  appliedAt?: string;
}

export interface SparkLink {
  id: string;
  sparkId: string;
  targetType: SparkTargetType;
  targetId: string;
  createdAt: string;
}

export type PeriodType = "weekly" | "monthly" | "yearly";

export interface PeriodSnapshot {
  id: string;
  periodType: PeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  revision: number;
  sourceHash: string;
  factsJson: string;
  createdAt: string;
  supersedesId?: string;
}

export interface AIReview {
  id: string;
  snapshotId: string;
  reviewType: PeriodType;
  revision: number;
  provider: string;
  model: string;
  sourceHash: string;
  content: string;
  generatedAt: string;
}

export interface ProfileSnapshot {
  id: string;
  evidenceEnd: string;
  revision: number;
  provider: string;
  model: string;
  sourceHash: string;
  evidenceJson: string;
  content: string;
  generatedAt: string;
}
