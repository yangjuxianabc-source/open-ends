import { describe, expect, it } from "vitest";
import type { ReadingEvent } from "@/types";
import { backfilledCompletionEvents, classifyRecordCompletion, completionEvents } from "./record-lifecycle";

const event = (id: string, type: ReadingEvent["type"], occurredAt: string): ReadingEvent => ({
  id,
  readingItemId: "book",
  type,
  occurredAt,
  localDate: occurredAt.slice(0, 10),
  timezone: "Asia/Shanghai",
});

describe("record lifecycle semantics", () => {
  it("distinguishes backfills from active progress", () => {
    const backfill = [event("added", "added", "2026-08-01T00:00:00Z"), event("finish", "finished", "2026-08-30T00:00:00Z")];
    const started = [...backfill.slice(0, 1), event("start", "started", "2026-08-20T00:00:00Z"), backfill[1]];
    const resumed = [backfill[0], event("start", "started", "2026-08-10T00:00:00Z"), event("pause", "paused", "2026-08-11T00:00:00Z"), event("resume", "resumed", "2026-08-20T00:00:00Z"), backfill[1]];
    const restarted = [backfill[0], event("finish", "finished", "2026-08-28T00:00:00Z"), event("restart", "restarted", "2026-08-29T00:00:00Z"), event("finish-2", "finished", "2026-08-30T00:00:00Z")];

    expect(classifyRecordCompletion(backfill, backfill[1])).toBe("backfill");
    expect(classifyRecordCompletion(started, backfill[1])).toBe("lifecycle");
    expect(classifyRecordCompletion(resumed, backfill[1])).toBe("lifecycle");
    expect(classifyRecordCompletion(restarted, restarted[3])).toBe("lifecycle");
    expect(completionEvents(backfill)).toHaveLength(0);
    expect(backfilledCompletionEvents(backfill)).toHaveLength(1);
    expect(completionEvents(restarted)).toHaveLength(1);
  });

  it("does not mistake a preference update for progress", () => {
    const events = [event("added", "added", "2026-08-01T00:00:00Z"), event("preference", "preference_changed", "2026-08-20T00:00:00Z"), event("finish", "finished", "2026-08-30T00:00:00Z")];
    expect(classifyRecordCompletion(events, events[2])).toBe("backfill");
  });
});
