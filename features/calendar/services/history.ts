import {addDays,fromDateKey,monthRange,toDateKey} from "@/lib/dates";
import type {DailyFocus,Task,TaskEvent} from "@/types";

export interface RescheduledOutFact{
  eventId:string;
  task:Task;
  toDate:string|undefined;
}

export interface DailyHistory{
  date:string;
  planned:Task[];
  completed:Task[];
  rescheduledOut:RescheduledOutFact[];
  dropped:Task[];
  added:Task[];
  focus?:Task;
}

export function buildDailyHistory(date:string,tasks:Task[],events:TaskEvent[],focusRows:DailyFocus[]):DailyHistory{
  const taskById=new Map(tasks.map(task=>[task.id,task]));
  const plannedIds=new Set(tasks.filter(task=>task.plannedDate===date).map(task=>task.id));
  for(const event of events)if(event.fromDate===date||event.toDate===date)plannedIds.add(event.taskId);
  const tasksForEvent=(type:TaskEvent["type"])=>uniqueTasks(events.filter(event=>event.type===type&&event.localDate===date).map(event=>event.taskId),taskById);
  const rescheduledOut=events.filter(event=>event.type==="rescheduled"&&event.fromDate===date&&event.toDate!==date).map(event=>{
    const task=taskById.get(event.taskId);return task?{eventId:event.id,task,toDate:event.toDate}:undefined;
  }).filter((fact):fact is RescheduledOutFact=>Boolean(fact)).sort((a,b)=>a.task.title.localeCompare(b.task.title)||a.eventId.localeCompare(b.eventId));
  const focus=focusRows.find(item=>item.date===date);
  return {
    date,
    planned:uniqueTasks([...plannedIds],taskById),
    completed:tasksForEvent("completed"),
    rescheduledOut,
    dropped:tasksForEvent("dropped"),
    added:tasksForEvent("created"),
    focus:focus?taskById.get(focus.taskId):undefined,
  };
}

export function buildMonthHistory(year:number,month:number,tasks:Task[],events:TaskEvent[],focusRows:DailyFocus[]){
  const {start,end}=monthRange(year,month);const result:Record<string,DailyHistory>={};let date=start;
  while(date<=end){result[date]=buildDailyHistory(date,tasks,events,focusRows);date=toDateKey(addDays(fromDateKey(date),1))}
  return result;
}

function uniqueTasks(ids:string[],taskById:Map<string,Task>){
  return [...new Set(ids)].map(id=>taskById.get(id)).filter((task):task is Task=>Boolean(task)).sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
