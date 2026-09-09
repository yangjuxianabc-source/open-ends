import { describe, expect, it } from "vitest";
import { parseSparkAnalysis, parseSparkAnalysisText } from "./schema";

const task = { kind: "task", title: "整理发布范围", contextPoints: ["确定目录", "列出验收条件"], domain: "project", timeBucket: "today", plannedDate: "2026-08-24", focusCandidate: true, confidence: 0.9, sourceSpan: "整理发布范围" } as const;

describe("Spark analysis schema", () => {
  it("accepts strict mixed results", () => {
    const result = parseSparkAnalysis({ sourceType: "mixed", items: [task, { kind: "reading", title: "设计原理", author: null, confidence: 0.8, sourceSpan: "设计原理" }] });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ kind: "task", plannedDate: "2026-08-24" });
  });

  it("preserves null plannedDate through serialize and reload", () => {
    const result = parseSparkAnalysis({ sourceType: "single", items: [{ ...task, plannedDate: null }] });
    const resultJson = JSON.stringify(result);
    const reloaded = parseSparkAnalysis(JSON.parse(resultJson));
    expect(result.items[0]).toMatchObject({ plannedDate: null });
    expect(reloaded.items[0]).toMatchObject({ plannedDate: null });
  });

  it("rejects malformed fields and unsupported extras", () => {
    expect(() => parseSparkAnalysis({ sourceType: "single", items: [{ ...task, extra: true }] })).toThrow("SPARK_SCHEMA_INVALID");
    expect(() => parseSparkAnalysisText("```json\n{}\n```" )).toThrow("SPARK_SCHEMA_INVALID");
    expect(() => parseSparkAnalysis({ sourceType: "single", items: [{ ...task, contextPoints: ["x", "x", "x", "x", "x", "x"] }] })).toThrow("SPARK_SCHEMA_INVALID");
  });

  it("allows an idea-only Spark without creating a derived item", () => {
    expect(parseSparkAnalysis({ sourceType: "idea_only", items: [] })).toEqual({ sourceType: "idea_only", items: [] });
  });

  it("accepts an unresolved reading or media object only in analysis", () => {
    expect(parseSparkAnalysis({sourceType:"single",items:[{kind:"ambiguous",title:"三体",confidence:.8,sourceSpan:"我想看三体"}]})).toEqual({
      sourceType:"single",
      items:[{kind:"ambiguous",title:"三体",confidence:.8,sourceSpan:"我想看三体"}],
    });
  });
});
