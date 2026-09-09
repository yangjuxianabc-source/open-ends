import type { MediaType, ReadingType, TaskDomain } from "@/types";

export type SparkSourceType = "single" | "mixed" | "idea_only";
export type SparkItemKind = "task" | "reading" | "media" | "ambiguous";
export type SparkTimeBucket = "today" | "this_week" | "later";

export interface SparkTaskSuggestion {
  kind: "task";
  title: string;
  contextPoints: string[];
  domain: TaskDomain;
  timeBucket: SparkTimeBucket;
  plannedDate: string | null;
  focusCandidate: boolean;
  confidence: number;
  sourceSpan: string;
}

export interface SparkReadingSuggestion {
  kind: "reading";
  title: string;
  author: string | null;
  confidence: number;
  sourceSpan: string;
}

export interface SparkMediaSuggestion {
  kind: "media";
  query: string;
  mediaTypeHint: MediaType | "unknown";
  confidence: number;
  sourceSpan: string;
}

export interface SparkAmbiguousSuggestion {
  kind: "ambiguous";
  title: string;
  confidence: number;
  sourceSpan: string;
}

export type SparkSuggestion = SparkTaskSuggestion | SparkReadingSuggestion | SparkMediaSuggestion | SparkAmbiguousSuggestion;

export interface SparkAnalysisResult {
  sourceType: SparkSourceType;
  items: SparkSuggestion[];
}

export interface SparkMediaCandidate {
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

export interface SparkReadingCandidate {
  provider: "google" | "openlibrary";
  externalId: string;
  title: string;
  authors: string[];
  url?: string;
  publisher?: string;
  publishedDate?: string;
  isbn10?: string;
  isbn13?: string;
}

export type SparkDraftItem =
  | (SparkTaskSuggestion & { enabled: boolean })
  | (SparkReadingSuggestion & { enabled: boolean; readingType: ReadingType; candidate?: SparkReadingCandidate; candidateRequired?: boolean })
  | (SparkMediaSuggestion & { enabled: boolean; candidate?: SparkMediaCandidate })
  | (SparkAmbiguousSuggestion & { enabled: boolean });
