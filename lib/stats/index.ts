import {isDateInRange,monthRange} from "@/lib/dates";
import {firstDroppedTaskIds,uniqueCompletedTaskIds} from "@/features/tasks/services/history";
import type {DailyFocus,Task,TaskDomain,TaskEvent} from "@/types";

const EMPTY_DOMAINS:Record<TaskDomain,number>={work:0,study:0,creation:0,project:0,life:0,health:0,relationship:0,reading:0,leisure:0,other:0};

export function periodTaskStats(tasks:Task[],events:TaskEvent[],focus:DailyFocus[],start:string,end:string){
  const inRange=events.filter(event=>isDateInRange(event.localDate,start,end));
  const scopedIds=new Set(tasks.filter(task=>task.plannedDate&&isDateInRange(task.plannedDate,start,end)).map(task=>task.id));
  for(const event of events)if(isDateInRange(event.localDate,start,end)||(event.fromDate&&isDateInRange(event.fromDate,start,end))||(event.toDate&&isDateInRange(event.toDate,start,end)))scopedIds.add(event.taskId);
  const domains=tasks.filter(task=>scopedIds.has(task.id)).reduce<Record<TaskDomain,number>>((acc,task)=>(acc[task.domain]++,acc),{...EMPTY_DOMAINS});
  const completed=uniqueCompletedTaskIds(events,start,end);
  const dropped=firstDroppedTaskIds(events,start,end);
  const focusRows=focus.filter(item=>isDateInRange(item.date,start,end));
  const completedByTaskAndDate=new Set(events.filter(event=>event.type==="completed").map(event=>`${event.taskId}\u0000${event.localDate}`));
  const focusCompleted=focusRows.filter(item=>completedByTaskAndDate.has(`${item.taskId}\u0000${item.date}`)).length;
  return {done:completed.size,rescheduled:inRange.filter(event=>event.type==="rescheduled").length,dropped:dropped.size,domains,focus:{assigned:focusRows.length,completed:focusCompleted}};
}

export const weeklyTaskStats=periodTaskStats;

export function monthlyTaskStats(tasks:Task[],events:TaskEvent[],year:number,month:number,focus:DailyFocus[]=[]){
  const {start,end}=monthRange(year,month);const stats=periodTaskStats(tasks,events,focus,start,end);
  const open=tasks.filter(task=>task.status==="open"&&task.plannedDate&&isDateInRange(task.plannedDate,start,end)).length;
  return {...stats,open};
}

export function tasksForDate(tasks:Task[],events:TaskEvent[],date:string){
  const ids=new Set(tasks.filter(task=>task.plannedDate===date).map(task=>task.id));
  for(const event of events)if(event.fromDate===date||event.toDate===date)ids.add(event.taskId);
  return tasks.filter(task=>ids.has(task.id));
}

export function groupOpenItems(tasks:Task[],today:string){
  const byDate=(a:Task,b:Task)=>(a.plannedDate??"9999-12-31").localeCompare(b.plannedDate??"9999-12-31")||a.createdAt.localeCompare(b.createdAt);
  const active=tasks.filter(task=>task.status==="open").sort(byDate);
  return {
    before:active.filter(task=>task.plannedDate&&task.plannedDate<today),
    today:active.filter(task=>task.plannedDate===today),
    after:active.filter(task=>!task.plannedDate||task.plannedDate>today),
    dropped:tasks.filter(task=>task.status==="dropped").sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),
  };
}
