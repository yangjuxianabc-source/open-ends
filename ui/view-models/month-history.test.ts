import { describe, expect, it } from "vitest";
import { createEmptyStore } from "@/lib/storage/migrate";
import type { Task, TaskEvent } from "@/types";
import { buildMonthViewModel } from "./month-history";

const task: Task = { id: "t", title: "历史任务", contextPoints: [], status: "done", domain: "creation", plannedDate: "2026-08-10", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-10T00:00:00Z" };
const event = (patch: Partial<TaskEvent>): TaskEvent => ({ id: "created", taskId: "t", type: "created", occurredAt: "2026-08-01T00:00:00Z", localDate: "2026-08-01", timezone: "Asia/Shanghai", ...patch });

describe("Month presentation model", () => {
  it("uses dated events and Focus history for the selected day", () => {
    const data = createEmptyStore();
    data.tasks = [task];
    data.taskEvents = [event({ id: "completed", type: "completed", localDate: "2026-08-10" })];
    data.dailyFocus = [{ date: "2026-08-01", taskId: "t", assignedAt: "2026-08-01T01:00:00Z" }];
    const result = buildMonthViewModel(data, 2026, 7, "2026-08-10");
    expect(result.selectedHistory.completed.map(item => item.id)).toEqual(["t"]);
    expect(result.historyByDate["2026-08-01"].focus?.id).toBe("t");
    expect(result.selectedDailyTasks).toEqual([]);
    expect(result.selectedFactCount).toBe(1);
  });

  it("shows only the latest planned date while keeping completions from older open work", () => {
    const data = createEmptyStore();
    const current: Task = { ...task, id: "current", title: "今天的新安排", status: "open", plannedDate: "2026-08-10" };
    const moved: Task = { ...task, id: "moved", title: "已经改到明天", status: "open", plannedDate: "2026-08-11" };
    const oldOpen: Task = { ...task, id: "old", title: "以前留下的任务", status: "done", plannedDate: "2026-08-01" };
    data.tasks = [current, moved, oldOpen];
    data.taskEvents = [
      event({ id: "moved-event", taskId: "moved", type: "rescheduled", localDate: "2026-08-10", fromDate: "2026-08-10", toDate: "2026-08-11" }),
      event({ id: "old-completed", taskId: "old", type: "completed", localDate: "2026-08-10" }),
    ];

    const result = buildMonthViewModel(data, 2026, 7, "2026-08-10");
    expect(result.selectedDailyTasks.map(item => item.id)).toEqual(["current"]);
    expect(result.selectedHistory.completed.map(item => item.id)).toEqual(["old"]);
    expect(result.selectedFactCount).toBe(2);
  });

  it("does not repeat a task in both visible detail sections", () => {
    const data = createEmptyStore();
    data.tasks = [task];
    data.taskEvents = [
      event({ id: "first-completion", type: "completed", localDate: "2026-08-10" }),
      event({ id: "second-completion", type: "completed", localDate: "2026-08-10", occurredAt: "2026-08-10T02:00:00Z" }),
    ];

    const result = buildMonthViewModel(data, 2026, 7, "2026-08-10");
    expect(result.selectedDailyTasks).toEqual([]);
    expect(result.selectedHistory.completed.map(item => item.id)).toEqual(["t"]);
    expect(result.selectedFactCount).toBe(1);
  });
});
