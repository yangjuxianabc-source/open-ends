import { describe, expect, it } from "vitest";
import type { AIReview, PeriodSnapshot } from "@/types";
import {
  generateReviewWithRetry,
  isRetryableReviewError,
  isReviewStale,
  latestReviewFor,
  nextReviewRevision,
  parseGeneratedContent,
} from "./generation";

const snapshot: PeriodSnapshot = {
  id: "s",
  periodType: "weekly",
  periodKey: "2026-08-17",
  periodStart: "2026-08-17",
  periodEnd: "2026-08-23",
  revision: 1,
  sourceHash: "hash",
  factsJson: "{}",
  createdAt: "2026-08-24T00:00:00Z",
};
const review: AIReview = {
  id: "r",
  snapshotId: "s",
  reviewType: "weekly",
  revision: 1,
  provider: "deepseek",
  model: "deepseek-v4-flash",
  sourceHash: "hash",
  content: "一段不可编辑的回顾。",
  generatedAt: "2026-08-24T00:00:00Z",
};

describe("AI review generation boundaries", () => {
  it("accepts only strict JSON content", () => {
    const fenced = ["```json", '{"content":"回顾"}', "```"].join("\n");
    const content =
      "## 这周做了什么\n真实回顾。\n\n## 还留在心里的事\n还有一点想法。";
    expect(parseGeneratedContent(JSON.stringify({ content }))).toBe(content);
    expect(() => parseGeneratedContent(fenced)).toThrow(
      "AI_INVALID_JSON_CONTENT",
    );
    expect(() => parseGeneratedContent('{"content":""}')).toThrow(
      "AI_EMPTY_CONTENT",
    );
    expect(() => parseGeneratedContent('{"content":"只有一整段文字"}')).toThrow(
      "AI_UNSTRUCTURED_CONTENT",
    );
  });
  it("keeps revisions and detects stale source hashes", () => {
    expect(nextReviewRevision([review], "s")).toBe(2);
    expect(latestReviewFor([review], snapshot)).toEqual(review);
    expect(isReviewStale(review, "hash")).toBe(false);
    expect(isReviewStale({ ...review, sourceHash: "old" }, "hash")).toBe(true);
  });
  it("retries one transient generation failure but never retries credential failures", async () => {
    const input = {
      current: {
        periodKey: "x",
        periodStart: "2026-08-17",
        periodEnd: "2026-08-23",
        sourceHash: "x",
        facts: {},
      },
      comparison: {
        schemaVersion: 1 as const,
        type: "weekly" as const,
        previous: [],
        monthlyTrajectory: [],
        longTermBaseline: [],
      },
    };
    let transientAttempts = 0;
    const retried = await generateReviewWithRetry(snapshot, input, {
      delayMs: 0,
      run: async () => {
        transientAttempts++;
        if (transientAttempts === 1) throw new Error("AI_INVALID_JSON_CONTENT");
        return review;
      },
    });
    expect(retried).toBe(review);
    expect(transientAttempts).toBe(2);
    let credentialAttempts = 0;
    await expect(
      generateReviewWithRetry(snapshot, input, {
        delayMs: 0,
        run: async () => {
          credentialAttempts++;
          throw new Error("INVALID_API_KEY");
        },
      }),
    ).rejects.toThrow("INVALID_API_KEY");
    expect(credentialAttempts).toBe(1);
    expect(isRetryableReviewError("UPSTREAM_UNAVAILABLE")).toBe(true);
    expect(isRetryableReviewError("CREDENTIAL_NOT_CONFIGURED")).toBe(false);
  });
});
