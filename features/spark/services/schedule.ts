import { addDays, fromDateKey, toDateKey } from "@/lib/dates";
import type { Task } from "@/types";
import type { SparkAnalysisResult } from "../types";

export function assignSparkDraftDates(
  result: SparkAnalysisResult,
  today: string,
  tasks: Pick<Task, "status" | "plannedDate">[],
): SparkAnalysisResult {
  const dates = Array.from({ length: 7 }, (_, index) =>
    toDateKey(addDays(fromDateKey(today), index + 1)),
  );
  const load = new Map(dates.map(date => [
    date,
    tasks.filter(task => task.status === "open" && task.plannedDate === date).length,
  ]));
  return {
    ...result,
    items: result.items.map(item => {
      if (item.kind !== "task" || item.timeBucket !== "this_week" || item.plannedDate) return item;
      const plannedDate = dates.reduce((best, date) =>
        (load.get(date) ?? 0) < (load.get(best) ?? 0) ? date : best,
      dates[0]);
      load.set(plannedDate, (load.get(plannedDate) ?? 0) + 1);
      return { ...item, plannedDate };
    }),
  };
}
