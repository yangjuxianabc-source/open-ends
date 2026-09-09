import { describe, expect, it } from "vitest";
import { createEmptyStore } from "@/lib/storage/migrate";
import type { Task, TaskEvent } from "@/types";
import { buildOpenThreadsViewModel } from "./open-threads";

const task = (id: string, status: Task["status"], plannedDate: string | undefined, createdAt = "2026-08-20T00:00:00Z"): Task => ({
  id, title: id, contextPoints: [], status, domain: "project", plannedDate, createdAt, updatedAt: createdAt,
});
const event = (patch: Partial<TaskEvent>): TaskEvent => ({ id: crypto.randomUUID(), taskId: "old", type: "created", occurredAt: "2026-08-20T00:00:00Z", localDate: "2026-08-20", timezone: "Asia/Shanghai", ...patch });

describe("Open Threads presentation model", () => {
  it("groups tasks and derives age/reschedule facts from events", () => {
    const data = createEmptyStore();
    data.tasks = [task("before", "open", "2026-08-20"), task("today", "open", "2026-08-27"), task("after", "open", "2026-09-01"), task("someday", "open", undefined), task("dropped", "dropped", "2026-08-20")];
    data.taskEvents = [
      event({ taskId: "before" }),
      event({ taskId: "before", type: "rescheduled", fromDate: "2026-08-19", toDate: "2026-08-20", localDate: "2026-08-19" }),
      event({ taskId: "before", type: "rescheduled", fromDate: "2026-08-18", toDate: "2026-08-20", localDate: "2026-08-18" }),
      event({ taskId: "dropped", type: "dropped", localDate: "2026-08-20" }),
    ];
    const result = buildOpenThreadsViewModel(data, "2026-08-27");
    expect(result.before.map(item => item.task.id)).toEqual(["before"]);
    expect(result.today.map(item => item.task.id)).toEqual(["today"]);
    expect(result.after.map(item => item.task.id)).toEqual(["after", "someday"]);
    expect(result.dropped.map(item => item.task.id)).toEqual(["dropped"]);
    expect(result.before[0]).toMatchObject({ ageInDays: 7, rescheduleCount: 2 });
  });

  it("keeps Focus dates available for historical and someday open tasks", () => {
    const data = createEmptyStore();
    data.tasks = [task("before", "open", "2026-08-20"), task("someday", "open", undefined)];
    data.dailyFocus = [
      { date: "2026-09-02", taskId: "someday", assignedAt: "2026-09-01T01:00:00Z" },
      { date: "2026-08-19", taskId: "before", assignedAt: "2026-08-19T01:00:00Z" },
    ];

    const result = buildOpenThreadsViewModel(data, "2026-08-27");

    expect(result.focusDatesByTask).toEqual({ before: ["2026-08-19"], someday: ["2026-09-02"] });
  });
});
