import { describe, expect, it } from "vitest";
import { createEmptyStore } from "@/lib/storage/migrate";
import type { AIReview, PeriodSnapshot, ReadingEvent, ReadingItem, Task, TaskEvent } from "@/types";
import { buildPeriodDescriptor, buildProfileViewModel, buildReviewViewModel, buildArchiveViewModel } from "./review";

const task: Task = { id: "task", title: "整理作品集", contextPoints: [], status: "done", domain: "creation", plannedDate: "2026-08-20", createdAt: "2026-08-18T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z" };
const taskEvent: TaskEvent = { id: "completed", taskId: "task", type: "completed", occurredAt: "2026-08-20T01:00:00Z", localDate: "2026-08-20", timezone: "Asia/Shanghai" };
const reading: ReadingItem = { id: "reading", title: "一本书", type: "book", status: "finished", createdAt: "2026-08-19T00:00:00Z", updatedAt: "2026-08-21T00:00:00Z" };
const readingEvent: ReadingEvent = { id: "reading-finished", readingItemId: "reading", type: "finished", occurredAt: "2026-08-21T01:00:00Z", localDate: "2026-08-21", timezone: "Asia/Shanghai" };
const snapshot: PeriodSnapshot = { id: "snapshot", periodType: "weekly", periodKey: "2026-08-17", periodStart: "2026-08-17", periodEnd: "2026-08-23", revision: 1, sourceHash: "source", factsJson: "{}", createdAt: "2026-08-24T00:00:00Z" };
const review: AIReview = { id: "review", snapshotId: "snapshot", reviewType: "weekly", revision: 1, provider: "deepseek", model: "deepseek-v4-flash", sourceHash: "source", content: "## 做过的事\n整理作品集。\n\n## 留下的线索\n继续。", generatedAt: "2026-08-24T01:00:00Z" };

describe("Review and archive presentation models", () => {
  it("selects the latest snapshot/review and exposes structured facts", () => {
    const data = createEmptyStore();
    data.tasks = [task];
    data.taskEvents = [taskEvent];
    data.dailyFocus = [{ date: "2026-08-20", taskId: "task", assignedAt: "2026-08-20T00:30:00Z" }];
    data.readingItems = [reading];
    data.readingEvents = [{ id: "reading-started", readingItemId: "reading", type: "started", occurredAt: "2026-08-19T01:00:00Z", localDate: "2026-08-19", timezone: "Asia/Shanghai" }, readingEvent];
    data.periodSnapshots = [snapshot];
    data.aiReviews = [review];
    const descriptor = buildPeriodDescriptor("weekly", new Date("2026-08-20T00:00:00Z"));
    const result = buildReviewViewModel(data, descriptor, descriptor,"source");
    expect(result.snapshot).toEqual(snapshot);
    expect(result.review).toEqual(review);
    expect(result.stale).toBe(false);
    expect(result.stats.done).toBe(1);
    expect(result.stats.focus.completed).toBe(1);
    expect(result.domains).toContainEqual(["creation", 1]);
    expect(result.recordFacts).toContainEqual(expect.objectContaining({ title: "一本书", kind: "完成阅读" }));
  });

  it("marks an AI review stale when the selected snapshot source changes", () => {
    const data = createEmptyStore();
    data.periodSnapshots = [{ ...snapshot, sourceHash: "new-source" }];
    data.aiReviews = [review];
    const descriptor = buildPeriodDescriptor("weekly", new Date("2026-08-20T00:00:00Z"));
    expect(buildReviewViewModel(data, descriptor, descriptor,"new-source").stale).toBe(true);
  });

  it("keeps profile and archive output read-only and derived", () => {
    const data = createEmptyStore();
    data.tasks = [task];
    data.taskEvents = [taskEvent];
    data.readingItems = [reading];
    data.readingEvents = [readingEvent];
    data.profileSnapshots = [{ id: "profile", evidenceEnd: "2026-08-27", revision: 1, provider: "deepseek", model: "deepseek-v4-flash", sourceHash: "profile-source", evidenceJson: "{}", content: "## 线索\n有一件事。", generatedAt: "2026-08-27T01:00:00Z" }];
    const profile = buildProfileViewModel(data, "2026-08-27");
    expect(profile.profile?.id).toBe("profile");
    expect(profile.pack.schemaVersion).toBe(2);
    expect(buildArchiveViewModel(data).completedTasks.map(item => item.id)).toEqual(["task"]);
    expect(buildArchiveViewModel(data).readingEvents).toEqual([readingEvent]);
  });
});
