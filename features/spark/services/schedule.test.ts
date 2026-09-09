import { describe, expect, it } from "vitest";
import type { SparkAnalysisResult } from "../types";
import { assignSparkDraftDates } from "./schedule";

const task = (title: string, timeBucket: "today" | "this_week" | "later", plannedDate: string | null) => ({
  kind: "task" as const,
  title,
  contextPoints: [],
  domain: "project" as const,
  timeBucket,
  plannedDate,
  focusCandidate: false,
  confidence: 1,
  sourceSpan: title,
});

describe("Spark deterministic date suggestions", () => {
  it("spreads this-week tasks over the least loaded future dates", () => {
    const result: SparkAnalysisResult = { sourceType: "mixed", items: [
      task("一", "this_week", null),
      task("二", "this_week", null),
      task("三", "this_week", null),
    ] };
    const scheduled = assignSparkDraftDates(result, "2026-08-28", [
      { status: "open", plannedDate: "2026-08-29" },
    ]);
    expect(scheduled.items.map(item => item.kind === "task" ? item.plannedDate : null))
      .toEqual(["2026-08-30", "2026-08-31", "2026-09-01"]);
  });

  it("preserves explicit dates and leaves later unscheduled", () => {
    const result: SparkAnalysisResult = { sourceType: "mixed", items: [
      task("明确", "this_week", "2026-09-03"),
      task("某天", "later", null),
    ] };
    const scheduled = assignSparkDraftDates(result, "2026-08-28", []);
    expect(scheduled.items).toMatchObject([
      { plannedDate: "2026-09-03" },
      { plannedDate: null, timeBucket: "later" },
    ]);
  });
});
