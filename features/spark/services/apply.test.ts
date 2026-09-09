import { describe, expect, it } from "vitest";
import { createEmptyStore } from "@/lib/storage/migrate";
import type { SparkDraftItem } from "../types";
import { applySparkDraft } from "./apply";

describe("apply Spark draft", () => {
  it("creates only confirmed entities after analysis and preserves provenance", () => {
    const data = createEmptyStore();
    data.sparks = [{ id: "spark-1", content: "做一个小项目", status: "inbox", createdAt: "2026-08-24T00:00:00Z" }];
    data.sparkRevisions = [{ id: "revision-1", sparkId: "spark-1", revision: 1, content: "做一个小项目", sourceHash: "hash", createdAt: "2026-08-24T00:00:00Z" }];
    data.sparkAnalysis = [{ id: "analysis-1", sparkId: "spark-1", sparkRevision: 1, provider: "deepseek", model: "deepseek-v4-flash", sourceHash: "hash", resultJson: "{}", createdAt: "2026-08-24T00:01:00Z" }];
    const items: SparkDraftItem[] = [
      { kind: "task", title: "定义范围", contextPoints: ["只做最小版本"], domain: "project", timeBucket: "today", plannedDate: "2026-08-24", focusCandidate: true, confidence: 0.9, sourceSpan: "定义范围", enabled: true },
      { kind: "task", title: "被用户取消", contextPoints: [], domain: "project", timeBucket: "later", plannedDate: null, focusCandidate: false, confidence: 0.4, sourceSpan: "以后再做", enabled: false },
    ];
    const result = applySparkDraft(data, "spark-1", "analysis-1", items, { now: "2026-08-24T00:02:00Z", today: "2026-08-24", id: (() => { let n = 0; return () => `id-${++n}`; })() });
    expect(result.created.tasks).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.data.tasks[0]).toMatchObject({ title: "定义范围", plannedDate: "2026-08-24" });
    expect(result.data.taskEvents.map(event => event.type)).toEqual(expect.arrayContaining(["created", "scheduled"]));
    expect(result.data.sparkLinks[0]).toMatchObject({ sparkId: "spark-1", targetType: "task", targetId: result.created.tasks[0] });
    expect(result.data.dailyFocus[0].taskId).toBe(result.created.tasks[0]);
    expect(result.data.sparkAnalysis[0].appliedAt).toBe("2026-08-24T00:02:00Z");
    expect(result.data.sparks[0].status).toBe("organized");
  });

  it("rejects empty confirmed draft item", () => {
    const items: SparkDraftItem[] = [
      { kind: "task", title: " ", contextPoints: [], domain: "other", timeBucket: "later", plannedDate: null, focusCandidate: false, confidence: 1, sourceSpan: "", enabled: true },
      { kind: "reading", title: "", author: null, readingType: "book", confidence: 1, sourceSpan: "", enabled: true },
      { kind: "media", query: "   ", mediaTypeHint: "unknown", confidence: 1, sourceSpan: "", candidate: { tmdbId: 1, mediaType: "movie", title: "候选影视", genreIds: [] }, enabled: true },
    ];
    for (const item of items) {
      const data = createEmptyStore();
      data.sparks = [{ id: "spark-1", content: "x", status: "inbox", createdAt: "2026-08-24T00:00:00Z" }];
      data.sparkRevisions = [{ id: "revision-1", sparkId: "spark-1", revision: 1, content: "x", sourceHash: "hash", createdAt: "2026-08-24T00:00:00Z" }];
      data.sparkAnalysis = [{ id: "analysis-1", sparkId: "spark-1", sparkRevision: 1, provider: "deepseek", model: "deepseek-v4-flash", sourceHash: "hash", resultJson: "{}", createdAt: "2026-08-24T00:01:00Z" }];
      expect(() => applySparkDraft(data, "spark-1", "analysis-1", [item], { now: "2026-08-24T00:02:00Z", today: "2026-08-24" })).toThrow("SPARK_EMPTY_TITLE");
      expect(data.tasks).toHaveLength(0);
      expect(data.readingItems).toHaveLength(0);
      expect(data.mediaItems).toHaveLength(0);
    }
  });

  it("rejects analysis from an older Spark revision without deleting links", () => {
    const data=createEmptyStore();
    data.sparks=[{id:"spark-1",content:"新原文",status:"organized",createdAt:"2026-08-24T00:00:00Z"}];
    data.sparkRevisions=[
      {id:"r2",sparkId:"spark-1",revision:2,content:"新原文",sourceHash:"new",createdAt:"2026-08-25T00:00:00Z"},
      {id:"r1",sparkId:"spark-1",revision:1,content:"旧原文",sourceHash:"old",createdAt:"2026-08-24T00:00:00Z"},
    ];
    data.sparkAnalysis=[{id:"a1",sparkId:"spark-1",sparkRevision:1,provider:"deepseek",model:"deepseek-v4-flash",sourceHash:"old",resultJson:"{}",createdAt:"2026-08-24T01:00:00Z"}];
    data.tasks=[{id:"t1",title:"旧派生任务",contextPoints:[],status:"open",domain:"project",createdAt:"2026-08-24T00:00:00Z",updatedAt:"2026-08-24T00:00:00Z"}];
    data.sparkLinks=[{id:"l1",sparkId:"spark-1",targetType:"task",targetId:"t1",createdAt:"2026-08-24T01:00:00Z"}];
    expect(()=>applySparkDraft(data,"spark-1","a1",[],{now:"2026-08-25T01:00:00Z",today:"2026-08-25"})).toThrow("SPARK_ANALYSIS_STALE");
    expect(data.sparkLinks).toHaveLength(1);
  });
});
