import type { MediaType, TaskDomain } from "@/types";
import type {
  SparkAnalysisResult,
  SparkAmbiguousSuggestion,
  SparkMediaSuggestion,
  SparkReadingSuggestion,
  SparkSuggestion,
  SparkTaskSuggestion,
  SparkTimeBucket,
} from "../types";

const domains = new Set<TaskDomain>(["work", "study", "creation", "project", "life", "health", "relationship", "reading", "leisure", "other"]);
const timeBuckets = new Set<SparkTimeBucket>(["today", "this_week", "later"]);
const mediaHints = new Set<MediaType | "unknown">(["movie", "tv", "unknown"]);

export class SparkSchemaError extends Error {
  constructor(message: string) {
    super(`SPARK_SCHEMA_INVALID: ${message}`);
    this.name = "SparkSchemaError";
  }
}

export function parseSparkAnalysisText(text: string): SparkAnalysisResult {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("```") || trimmed.endsWith("```")) throw new SparkSchemaError("response must be a JSON object without Markdown fencing");
  try {
    return parseSparkAnalysis(JSON.parse(trimmed));
  } catch (error) {
    if (error instanceof SparkSchemaError) throw error;
    throw new SparkSchemaError("response is not valid JSON");
  }
}

export function parseSparkAnalysis(value: unknown): SparkAnalysisResult {
  const object = record(value, "root");
  exactKeys(object, ["sourceType", "items"], "root");
  const sourceType = stringValue(object.sourceType, "sourceType");
  if (sourceType !== "single" && sourceType !== "mixed" && sourceType !== "idea_only") throw new SparkSchemaError("sourceType is not supported");
  if (!Array.isArray(object.items)) throw new SparkSchemaError("items must be an array");
  if (object.items.length > 20) throw new SparkSchemaError("items cannot contain more than 20 entries");
  const items = object.items.map((item, index) => parseItem(item, index));
  if (sourceType === "idea_only" && items.length > 0) throw new SparkSchemaError("idea_only cannot contain derived items");
  if (sourceType === "single" && items.length !== 1) throw new SparkSchemaError("single must contain exactly one item");
  if (sourceType === "mixed" && items.length < 2) throw new SparkSchemaError("mixed must contain at least two items");
  return { sourceType, items };
}

function parseItem(value: unknown, index: number): SparkSuggestion {
  const object = record(value, `items[${index}]`);
  const kind = stringValue(object.kind, `items[${index}].kind`);
  if (kind === "task") return parseTask(object, index);
  if (kind === "reading") return parseReading(object, index);
  if (kind === "media") return parseMedia(object, index);
  if (kind === "ambiguous") return parseAmbiguous(object, index);
  throw new SparkSchemaError(`items[${index}].kind is not supported`);
}

function parseAmbiguous(object: Record<string, unknown>, index: number): SparkAmbiguousSuggestion {
  exactKeys(object, ["kind", "title", "confidence", "sourceSpan"], `items[${index}]`);
  return {
    kind: "ambiguous",
    title: boundedString(object.title, `items[${index}].title`, 160),
    confidence: confidenceValue(object.confidence, `items[${index}].confidence`),
    sourceSpan: boundedString(object.sourceSpan, `items[${index}].sourceSpan`, 500),
  };
}

function parseTask(object: Record<string, unknown>, index: number): SparkTaskSuggestion {
  exactKeys(object, ["kind", "title", "contextPoints", "domain", "timeBucket", "plannedDate", "focusCandidate", "confidence", "sourceSpan"], `items[${index}]`);
  const contextPoints = object.contextPoints;
  if (!Array.isArray(contextPoints) || contextPoints.length > 5 || contextPoints.some(point => typeof point !== "string" || !point.trim() || point.length > 60)) throw new SparkSchemaError(`items[${index}].contextPoints is invalid`);
  const plannedDate = nullableDate(object.plannedDate, `items[${index}].plannedDate`);
  if (contextPoints.join("").length > 180) throw new SparkSchemaError(`items[${index}].contextPoints is too long`);
  return {
    kind: "task",
    title: boundedString(object.title, `items[${index}].title`, 160),
    contextPoints: contextPoints.map(point => point.trim()),
    domain: enumValue(object.domain, domains, `items[${index}].domain`),
    timeBucket: enumValue(object.timeBucket, timeBuckets, `items[${index}].timeBucket`),
    plannedDate,
    focusCandidate: booleanValue(object.focusCandidate, `items[${index}].focusCandidate`),
    confidence: confidenceValue(object.confidence, `items[${index}].confidence`),
    sourceSpan: boundedString(object.sourceSpan, `items[${index}].sourceSpan`, 500),
  };
}

function parseReading(object: Record<string, unknown>, index: number): SparkReadingSuggestion {
  exactKeys(object, ["kind", "title", "author", "confidence", "sourceSpan"], `items[${index}]`);
  const author = object.author === null ? null : boundedString(object.author, `items[${index}].author`, 160);
  return {
    kind: "reading",
    title: boundedString(object.title, `items[${index}].title`, 160),
    author,
    confidence: confidenceValue(object.confidence, `items[${index}].confidence`),
    sourceSpan: boundedString(object.sourceSpan, `items[${index}].sourceSpan`, 500),
  };
}

function parseMedia(object: Record<string, unknown>, index: number): SparkMediaSuggestion {
  exactKeys(object, ["kind", "query", "mediaTypeHint", "confidence", "sourceSpan"], `items[${index}]`);
  return {
    kind: "media",
    query: boundedString(object.query, `items[${index}].query`, 160),
    mediaTypeHint: enumValue(object.mediaTypeHint, mediaHints, `items[${index}].mediaTypeHint`),
    confidence: confidenceValue(object.confidence, `items[${index}].confidence`),
    sourceSpan: boundedString(object.sourceSpan, `items[${index}].sourceSpan`, 500),
  };
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SparkSchemaError(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], path: string) {
  const expected = new Set(keys);
  const actual = Object.keys(value);
  if (actual.length !== expected.size || actual.some(key => !expected.has(key))) throw new SparkSchemaError(`${path} contains unsupported fields`);
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new SparkSchemaError(`${path} must be a non-empty string`);
  return value.trim();
}

function boundedString(value: unknown, path: string, maxLength: number): string {
  const text = stringValue(value, path);
  if (text.length > maxLength) throw new SparkSchemaError(`${path} exceeds ${maxLength} characters`);
  return text;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new SparkSchemaError(`${path} must be boolean`);
  return value;
}

function confidenceValue(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new SparkSchemaError(`${path} must be between 0 and 1`);
  return value;
}

function enumValue<T>(value: unknown, values: Set<T>, path: string): T {
  if (typeof value !== "string" || !values.has(value as T)) throw new SparkSchemaError(`${path} has an unsupported value`);
  return value as T;
}

function nullableDate(value: unknown, path: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new SparkSchemaError(`${path} must be YYYY-MM-DD or null`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new SparkSchemaError(`${path} is not a calendar date`);
  return value;
}
