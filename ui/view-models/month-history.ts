import { buildDailyHistory, buildMonthHistory, type DailyHistory } from "@/features/calendar/services/history";
import { monthlyTaskStats } from "@/lib/stats";
import { toDateKey } from "@/lib/dates";
import type { StoreData } from "@/lib/storage/migrate";
import type { Task } from "@/types";

export interface MonthDayViewModel extends DailyHistory {
  activityWeight: number;
}

export interface MonthViewModel {
  year: number;
  month: number;
  stats: ReturnType<typeof monthlyTaskStats>;
  historyByDate: Record<string, MonthDayViewModel>;
  selectedDate: string;
  selectedHistory: MonthDayViewModel;
  selectedDailyTasks: Task[];
  selectedFactCount: number;
}

function withActivityWeight(history: DailyHistory): MonthDayViewModel {
  return {
    ...history,
    activityWeight: history.planned.length + history.completed.length + history.rescheduledOut.length + history.dropped.length + history.added.length + (history.focus ? 1 : 0),
  };
}

export function buildMonthViewModel(data: StoreData, year: number, month: number, selectedDate = toDateKey(new Date(year, month, 1))): MonthViewModel {
  const rawHistory = buildMonthHistory(year, month, data.tasks, data.taskEvents, data.dailyFocus);
  const historyByDate = Object.fromEntries(Object.entries(rawHistory).map(([date, history]) => [date, withActivityWeight(history)]));
  const selectedHistory = historyByDate[selectedDate] ?? withActivityWeight(buildDailyHistory(selectedDate, data.tasks, data.taskEvents, data.dailyFocus));
  const completedIds = new Set(selectedHistory.completed.map(task => task.id));
  const selectedDailyTasks = data.tasks
    .filter(task => task.plannedDate === selectedDate && task.status !== "dropped" && !completedIds.has(task.id) && task.id !== selectedHistory.focus?.id)
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  return {
    year,
    month,
    stats: monthlyTaskStats(data.tasks, data.taskEvents, year, month, data.dailyFocus),
    historyByDate,
    selectedDate,
    selectedHistory,
    selectedDailyTasks,
    selectedFactCount: selectedDailyTasks.length + selectedHistory.completed.filter(task => task.id !== selectedHistory.focus?.id).length + (selectedHistory.focus ? 1 : 0),
  };
}
