import { describe, expect, it } from "vitest";
import { createEmptyStore } from "@/lib/storage/migrate";
import type { Task, SparkLink } from "@/types";
import { reconcileSparkStatus, sparkProgress } from "./lifecycle";

const task: Task = { id: "task-1", title: "完成任务", contextPoints: [], status: "done", domain: "project", createdAt: "2026-08-24T00:00:00Z", updatedAt: "2026-08-24T00:00:00Z" };
const link: SparkLink = { id: "link-1", sparkId: "spark-1", targetType: "task", targetId: task.id, createdAt: task.createdAt };

describe("Spark lifecycle", () => {
  it("settles only when at least one existing linked target is terminal", () => {
    const data = createEmptyStore();
    data.sparks = [{ id: "spark-1", content: "x", status: "inbox", createdAt: task.createdAt }];
    data.tasks = [task];
    data.sparkLinks = [link];
    const next = reconcileSparkStatus(data, "spark-1", "2026-08-24T01:00:00Z");
    expect(next.sparks[0]).toMatchObject({ status: "settled", settledAt: "2026-08-24T01:00:00Z" });
  });

  it("does not settle a Spark with no links and reopens after restore", () => {
    const empty = createEmptyStore();
    empty.sparks = [{ id: "spark-1", content: "x", status: "inbox", createdAt: task.createdAt }];
    expect(reconcileSparkStatus(empty, "spark-1", task.createdAt).sparks[0].status).toBe("inbox");
    const organized = { ...empty, tasks: [{ ...task, status: "done" as const }], sparkLinks: [link] };
    const settled = reconcileSparkStatus(organized, "spark-1", "2026-08-24T01:00:00Z");
    const restored = reconcileSparkStatus({ ...settled, tasks: [{ ...task, status: "open" as const }] }, "spark-1", "2026-08-24T02:00:00Z");
    expect(restored.sparks[0].status).toBe("organized");
    expect(sparkProgress(restored, "spark-1")).toMatchObject({ total: 1, settled: 0 });
  });

  it("keeps archived as a manual-only state", () => {
    const data = createEmptyStore();
    data.sparks = [{ id: "spark-1", content: "x", status: "archived", createdAt: task.createdAt }];
    data.tasks = [task];
    data.sparkLinks = [link];
    expect(reconcileSparkStatus(data, "spark-1", "2026-08-24T01:00:00Z").sparks[0].status).toBe("archived");
  });
});
