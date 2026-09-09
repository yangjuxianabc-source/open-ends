import type { StoreData } from "@/lib/storage/migrate";
import type { Task } from "@/types";

export interface TodayTaskGroup {
  key: string;
  sourceSparkId?: string;
  tasks: Task[];
  completed: boolean;
  firstCreatedAt: string;
  completedAt?: string;
}

export interface TodayViewModel {
  date: string;
  focus?: Task;
  focusCompleted: boolean;
  todayTasks: Task[];
  otherTasks: Task[];
  otherTaskGroups: TodayTaskGroup[];
}

export function buildTodayViewModel(data: StoreData, today: string): TodayViewModel {
  const focusRow = data.dailyFocus.find(item => item.date === today);
  const focus = focusRow ? data.tasks.find(task => task.id === focusRow.taskId) : undefined;
  const todayTasks = data.tasks.filter(task => task.plannedDate === today && task.status !== "dropped");
  const otherTasks = todayTasks.filter(task => task.id !== focus?.id);
  const linksByTask = new Map<string, string>();
  for (const link of data.sparkLinks) {
    if (link.targetType === "task" && !linksByTask.has(link.targetId)) linksByTask.set(link.targetId, link.sparkId);
  }
  const eventTimesByTask = new Map<string, string[]>();
  for (const event of data.taskEvents) {
    if (event.type !== "completed") continue;
    eventTimesByTask.set(event.taskId, [...(eventTimesByTask.get(event.taskId) ?? []), event.occurredAt]);
  }
  const taskOrder = new Map(otherTasks.map((task, index) => [task.id, index]));
  const groups = new Map<string, TodayTaskGroup>();
  for (const task of otherTasks) {
    const sourceSparkId = linksByTask.get(task.id);
    const key = sourceSparkId ? `spark:${sourceSparkId}` : `task:${task.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.tasks.push(task);
      existing.firstCreatedAt = minTimestamp(existing.firstCreatedAt, task.createdAt);
      continue;
    }
    groups.set(key, {
      key,
      sourceSparkId,
      tasks: [task],
      completed: false,
      firstCreatedAt: task.createdAt,
    });
  }

  const otherTaskGroups = [...groups.values()].map(group => {
    group.tasks.sort((a, b) => {
      const doneOrder = Number(a.status === "done") - Number(b.status === "done");
      if (doneOrder) return doneOrder;
      return a.createdAt.localeCompare(b.createdAt) || (taskOrder.get(a.id) ?? 0) - (taskOrder.get(b.id) ?? 0) || a.id.localeCompare(b.id);
    });
    group.completed = group.tasks.every(task => task.status === "done");
    if (group.completed) {
      const completionTimes = group.tasks.flatMap(task => eventTimesByTask.get(task.id) ?? (task.completedAt ? [task.completedAt] : []));
      group.completedAt = completionTimes.sort().at(-1);
    }
    return group;
  });

  otherTaskGroups.sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if (a.completed && b.completed) return (a.completedAt ?? a.firstCreatedAt).localeCompare(b.completedAt ?? b.firstCreatedAt);
    return a.firstCreatedAt.localeCompare(b.firstCreatedAt) || a.key.localeCompare(b.key);
  });

  return {
    date: today,
    focus,
    focusCompleted: focus?.status === "done",
    todayTasks,
    otherTasks: otherTaskGroups.flatMap(group => group.tasks),
    otherTaskGroups,
  };
}

function minTimestamp(first: string, second: string) {
  return first.localeCompare(second) <= 0 ? first : second;
}
