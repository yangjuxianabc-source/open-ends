import { deepseekRequest } from "@/lib/desktop/tauri-client";
import type { AIReview, PeriodSnapshot, PeriodType } from "@/types";
import { DEEPSEEK_REQUEST_DEFAULTS } from "@/lib/ai/deepseek";
import { buildReviewPrompt } from "./prompts";
import type { ReviewGenerationInput } from "./comparison";
import { reviewInputHash } from "./comparison";

const retryableErrors = new Set([
  "UPSTREAM_REQUEST_FAILED",
  "UPSTREAM_UNAVAILABLE",
  "UPSTREAM_INVALID_RESPONSE",
  "AI_INVALID_JSON_CONTENT",
  "AI_INVALID_CONTENT_SCHEMA",
  "AI_EMPTY_CONTENT",
  "AI_UNSTRUCTURED_CONTENT",
]);

interface DeepSeekResponse {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
}

export function parseGeneratedContent(text: string) {
  const source = text.trim();
  if (!source || source.startsWith("```") || source.endsWith("```"))
    throw new Error("AI_INVALID_JSON_CONTENT");
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("AI_INVALID_JSON_CONTENT");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as { content?: unknown }).content !== "string"
  )
    throw new Error("AI_INVALID_CONTENT_SCHEMA");
  const content = (parsed as { content: string }).content.trim();
  if (!content) throw new Error("AI_EMPTY_CONTENT");
  if ((content.match(/^##\s+.+$/gm) ?? []).length < 2)
    throw new Error("AI_UNSTRUCTURED_CONTENT");
  return content;
}

export async function generateReview(
  snapshot: PeriodSnapshot,
  input: ReviewGenerationInput,
  now = new Date().toISOString(),
  id = crypto.randomUUID(),
): Promise<AIReview> {
  const response = await deepseekRequest<DeepSeekResponse>(
    buildReviewPrompt(snapshot, input),
  );
  const text = response.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("UPSTREAM_INVALID_RESPONSE");
  return {
    id,
    snapshotId: snapshot.id,
    reviewType: snapshot.periodType,
    revision: 1,
    provider: "deepseek",
    model:
      typeof response.model === "string" && response.model.trim()
        ? response.model
        : DEEPSEEK_REQUEST_DEFAULTS.model,
    sourceHash: await reviewInputHash(input),
    content: parseGeneratedContent(text),
    generatedAt: now,
  };
}

export function isRetryableReviewError(error: unknown) {
  return retryableErrors.has(
    error instanceof Error ? error.message : String(error),
  );
}

export async function generateReviewWithRetry(
  snapshot: PeriodSnapshot,
  input: ReviewGenerationInput,
  options: { delayMs?: number; run?: typeof generateReview } = {},
) {
  const run = options.run ?? generateReview;
  try {
    return await run(snapshot, input);
  } catch (error) {
    if (!isRetryableReviewError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? 200));
    return run(snapshot, input);
  }
}

export function nextReviewRevision(reviews: AIReview[], snapshotId: string) {
  return (
    Math.max(
      0,
      ...reviews
        .filter((review) => review.snapshotId === snapshotId)
        .map((review) => review.revision),
    ) + 1
  );
}
export function latestReviewFor(
  reviews: AIReview[],
  snapshot: PeriodSnapshot | undefined,
) {
  return snapshot
    ? reviews
        .filter((review) => review.snapshotId === snapshot.id)
        .sort((a, b) => b.revision - a.revision)[0]
    : undefined;
}
export function isReviewStale(
  review: AIReview | undefined,
  currentInputHash: string | undefined,
) {
  return Boolean(
    review && currentInputHash && review.sourceHash !== currentInputHash,
  );
}
export function reviewTypeLabel(type: PeriodType) {
  return type === "weekly" ? "周度" : type === "monthly" ? "月度" : "年度";
}
