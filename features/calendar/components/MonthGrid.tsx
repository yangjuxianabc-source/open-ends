import { getMonthGrid } from "@/lib/dates";
import {buildDailyHistory,type DailyHistory} from "@/features/calendar/services/history";
import type {DailyFocus,Task,TaskEvent} from "@/types";
import { DayCell } from "./DayCell";

export function MonthGrid({ year, month, tasks, events, focus, historyByDate, selected, onSelect }: { year: number; month: number; tasks: Task[]; events: TaskEvent[]; focus: DailyFocus[]; historyByDate:Record<string,DailyHistory>; selected: string; onSelect: (d: string) => void }) {
  return (
    <>
      <div className="weekdays">{["一", "二", "三", "四", "五", "六", "日"].map(d => <span key={d}>周{d}</span>)}</div>
      <div className="month-grid">
        {getMonthGrid(year, month).map(day => (
          <DayCell key={day.date} day={day} history={historyByDate[day.date]??buildDailyHistory(day.date,tasks,events,focus)} selected={selected === day.date} onSelect={() => onSelect(day.date)} />
        ))}
      </div>
    </>
  );
}
