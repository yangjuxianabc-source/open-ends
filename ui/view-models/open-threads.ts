import { fromDateKey } from "@/lib/dates";
import { groupOpenItems } from "@/lib/stats";
import { rescheduleCount } from "@/features/tasks/services/history";
import type { StoreData } from "@/lib/storage/migrate";
import type { Task, TaskEvent } from "@/types";

export interface OpenThreadItem {
  task: Task;
  ageInDays: number;
  rescheduleCount: number;
  lastEvent?: TaskEvent;
  sourceSparkId?: string;
}

export interface OpenThreadsViewModel {
  today: OpenThreadItem[];
  before: OpenThreadItem[];
  after: OpenThreadItem[];
  dropped: OpenThreadItem[];
  focusDatesByTask: Record<string, string[]>;
}

export function buildOpenThreadsViewModel(data: StoreData, today: string): OpenThreadsViewModel {
  const groups = groupOpenItems(data.tasks, today);
  const focusDatesByTask: Record<string, string[]> = {};
  for (const focus of data.dailyFocus) {
    const dates = focusDatesByTask[focus.taskId] ?? [];
    if (!dates.includes(focus.date)) dates.push(focus.date);
    focusDatesByTask[focus.taskId] = dates;
  }
  for (const dates of Object.values(focusDatesByTask)) dates.sort();
  const eventsByTask = new Map<string, TaskEvent[]>();
  for (const event of data.taskEvents) eventsByTask.set(event.taskId, [...(eventsByTask.get(event.taskId) ?? []), event]);
  const linksByTask = new Map<string, string>();
  for (const link of data.sparkLinks) if (link.targetType === "task" && !linksByTask.has(link.targetId)) linksByTask.set(link.targetId, link.sparkId);

  const toItem = (task: Task): OpenThreadItem => {
    const events = [...(eventsByTask.get(task.id) ?? [])].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
    const created = events.find(event => event.type === "created");
    const createdDate = created?.localDate ?? task.createdAt.slice(0, 10);
    const ageInDays = Math.max(0, Math.floor((fromDateKey(today).getTime() - fromDateKey(createdDate).getTime()) / 86400000));
    return {
      task,
      ageInDays,
      rescheduleCount: rescheduleCount(task.id, data.taskEvents),
      lastEvent: events[events.length - 1],
      sourceSparkId: linksByTask.get(task.id),
    };
  };

  return {
    today: groups.today.map(toItem),
    before: groups.before.map(toItem),
    after: groups.after.map(toItem),
    dropped: groups.dropped.map(toItem),
    focusDatesByTask,
  };
}
