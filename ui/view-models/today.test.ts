import { describe, expect, it } from "vitest";
import { createEmptyStore } from "@/lib/storage/migrate";
import type { Task } from "@/types";
import { buildTodayViewModel } from "./today";

const task = (id: string, status: Task["status"], plannedDate = "2026-08-27"): Task => ({
  id, title: id, contextPoints: [], status, domain: "work", plannedDate,
  createdAt: "2026-08-27T00:00:00Z", updatedAt: "2026-08-27T00:00:00Z",
});

describe("Today presentation model", () => {
  it("keeps a completed Focus visible and excludes it from other tasks", () => {
    const data = createEmptyStore();
    data.tasks = [task("focus", "done"), task("other", "open"), task("dropped", "dropped")];
    data.dailyFocus = [{ date: "2026-08-27", taskId: "focus", assignedAt: "2026-08-27T01:00:00Z" }];
    const result = buildTodayViewModel(data, "2026-08-27");
    expect(result.focus?.id).toBe("focus");
    expect(result.focusCompleted).toBe(true);
    expect(result.todayTasks.map(item => item.id)).toEqual(["focus", "other"]);
    expect(result.otherTasks.map(item => item.id)).toEqual(["other"]);
  });

  it("keeps Spark siblings together, puts unfinished work first, and sinks completed groups", () => {
    const data = createEmptyStore();
    data.tasks = [
      task("a1", "open"),
      task("b", "open"),
      task("a2", "done"),
      task("a3", "open"),
    ];
    data.sparkLinks = [
      { id: "link-a1", sparkId: "spark-a", targetType: "task", targetId: "a1", createdAt: "2026-08-27T01:00:00Z" },
      { id: "link-a2", sparkId: "spark-a", targetType: "task", targetId: "a2", createdAt: "2026-08-27T01:00:00Z" },
      { id: "link-a3", sparkId: "spark-a", targetType: "task", targetId: "a3", createdAt: "2026-08-27T01:00:00Z" },
    ];
    const result = buildTodayViewModel(data, "2026-08-27");
    expect(result.otherTasks.map(item => item.id)).toEqual(["a1", "a3", "a2", "b"]);
    expect(result.otherTaskGroups.map(group => group.key)).toEqual(["spark:spark-a", "task:b"]);
  });

  it("moves a fully completed Spark group behind active groups while preserving siblings after Focus removal", () => {
    const data = createEmptyStore();
    data.tasks = [task("focus", "open"), task("a2", "done"), task("b", "open")];
    data.dailyFocus = [{ date: "2026-08-27", taskId: "focus", assignedAt: "2026-08-27T01:00:00Z" }];
    data.sparkLinks = [
      { id: "link-focus", sparkId: "spark-a", targetType: "task", targetId: "focus", createdAt: "2026-08-27T01:00:00Z" },
      { id: "link-a2", sparkId: "spark-a", targetType: "task", targetId: "a2", createdAt: "2026-08-27T01:00:00Z" },
    ];
    const result = buildTodayViewModel(data, "2026-08-27");
    expect(result.otherTaskGroups.map(group => group.key)).toEqual(["task:b", "spark:spark-a"]);
    expect(result.otherTaskGroups[1].tasks.map(item => item.id)).toEqual(["a2"]);
  });
});
