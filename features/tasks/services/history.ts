import type {Task,TaskEvent} from "@/types";

export const rescheduleCount=(taskId:string,events:TaskEvent[])=>events.filter(event=>event.taskId===taskId&&event.type==="rescheduled").length;
export const withRescheduledDate=(task:Task,plannedDate:string|undefined,updatedAt:string):Task=>({...task,plannedDate,updatedAt});
export const plannedDateEventType=(fromDate:string|undefined,toDate:string|undefined):"scheduled"|"rescheduled"=>!fromDate&&toDate?"scheduled":"rescheduled";

export function uniqueCompletedTaskIds(events:TaskEvent[],start:string,end:string){
  return new Set(events.filter(event=>event.type==="completed"&&event.localDate>=start&&event.localDate<=end).map(event=>event.taskId));
}

export function firstDroppedTaskIds(events:TaskEvent[],start:string,end:string){
  const firstByTask=new Map<string,TaskEvent>();
  for(const event of [...events].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt))){if(event.type==="dropped"&&!firstByTask.has(event.taskId))firstByTask.set(event.taskId,event)}
  return new Set([...firstByTask.values()].filter(event=>event.localDate>=start&&event.localDate<=end).map(event=>event.taskId));
}
