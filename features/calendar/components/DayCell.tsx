import type { CalendarDay } from "@/lib/dates";
import type { DailyHistory } from "@/features/calendar/services/history";
import {FocusIcon} from "@/components/ui/FocusIcon";

export function DayCell({ day, history, selected, onSelect }: { day: CalendarDay; history: DailyHistory; selected: boolean; onSelect: () => void }) {
  const factCount=history.planned.length+history.completed.length+history.rescheduledOut.length+history.dropped.length+history.added.length+(history.focus?1:0);
  const summary=history.planned.length?`${history.completed.length}/${history.planned.length} 完成`:factCount?`${factCount} 条记录`:"";
  return (
    <button className={`day-cell ${!day.isCurrentMonth ? "outside" : ""} ${selected ? "selected" : ""}`} onClick={onSelect} aria-label={`${day.date}，${factCount} 条生活事实`}>
      <span>{day.day}</span>
      <small>{summary}</small>
      <div className="day-marks">
        {history.planned.length>0&&<i className="task-mark"/>}
        {history.completed.length>0&&<i className="completion-mark"/>}
        {history.rescheduledOut.length>0&&<i className="reschedule-mark"/>}
        {history.dropped.length>0&&<i className="dropped-mark"/>}
        {history.focus&&<FocusIcon className="day-focus-mark" active />}
      </div>
    </button>
  );
}
