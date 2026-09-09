import type { MediaEvent, ReadingEvent } from "@/types";

export type RecordLifecycleEvent = ReadingEvent | MediaEvent;
export type RecordCompletionKind = "lifecycle" | "backfill";

const progressTypes = new Set(["started", "resumed", "restarted"]);

/**
 * A finish is a lifecycle completion only when this record has evidence of
 * being actively progressed before that finish. This keeps manual backfills
 * useful for taste evidence without treating them as current-period activity.
 */
export function classifyRecordCompletion(
  events: readonly RecordLifecycleEvent[],
  finishEvent: RecordLifecycleEvent,
): RecordCompletionKind {
  const recordId = getRecordId(finishEvent);
  const ordered = events
    .filter((event) => getRecordId(event) === recordId)
    .sort(compareEvents);
  const finishIndex = ordered.findIndex((event) => event.id === finishEvent.id);
  const beforeFinish = finishIndex >= 0
    ? ordered.slice(0, finishIndex)
    : ordered.filter((event) => compareEvents(event, finishEvent) < 0);
  return beforeFinish.some((event) => progressTypes.has(event.type)) ? "lifecycle" : "backfill";
}

export function completionEvents<T extends RecordLifecycleEvent>(
  events: readonly T[],
  start?: string,
  end?: string,
) {
  return events.filter((event) =>
    event.type === "finished" &&
    (start === undefined || event.localDate >= start) &&
    (end === undefined || event.localDate <= end) &&
    classifyRecordCompletion(events, event) === "lifecycle",
  );
}

export function backfilledCompletionEvents<T extends RecordLifecycleEvent>(
  events: readonly T[],
  start?: string,
  end?: string,
) {
  return events.filter((event) =>
    event.type === "finished" &&
    (start === undefined || event.localDate >= start) &&
    (end === undefined || event.localDate <= end) &&
    classifyRecordCompletion(events, event) === "backfill",
  );
}

export function recordId(event: RecordLifecycleEvent) {
  return getRecordId(event);
}

function getRecordId(event: RecordLifecycleEvent) {
  return "readingItemId" in event ? event.readingItemId : event.mediaItemId;
}

function compareEvents(a: RecordLifecycleEvent, b: RecordLifecycleEvent) {
  return compareText(a.occurredAt, b.occurredAt) || compareText(a.id, b.id);
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
