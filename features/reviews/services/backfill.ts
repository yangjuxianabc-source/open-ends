import {addDays,fromDateKey,getWeekRange,monthRange,toDateKey} from "@/lib/dates";
import type {StoreData} from "@/lib/storage/migrate";
import {buildMonthlySnapshot,buildWeeklySnapshot,buildYearlySnapshot,createSnapshotRevision,type SnapshotDraft} from "./snapshots";

export async function reconcileEndedSnapshots(data:StoreData,today:string,now:string,id:()=>string=()=>crypto.randomUUID()):Promise<StoreData>{
  const earliest=earliestFactDate(data);if(!earliest)return data;
  const drafts:SnapshotDraft[]=[];
  let weekStart=getWeekRange(fromDateKey(earliest)).start;
  while(toDateKey(addDays(fromDateKey(weekStart),6))<today){drafts.push(await buildWeeklySnapshot(data,weekStart));weekStart=toDateKey(addDays(fromDateKey(weekStart),7))}
  const [firstYear,firstMonth]=earliest.split("-").map(Number);let year=firstYear;let month=firstMonth-1;
  while(monthRange(year,month).end<today){drafts.push(await buildMonthlySnapshot(data,year,month));month++;if(month===12){month=0;year++}}
  for(let value=firstYear;`${value}-12-31`<today;value++)drafts.push(await buildYearlySnapshot(data,value));
  const periodSnapshots=[...data.periodSnapshots];
  for(const draft of drafts){const revision=createSnapshotRevision(draft,periodSnapshots,id(),now);if(revision)periodSnapshots.push(revision)}
  return periodSnapshots.length===data.periodSnapshots.length?data:{...data,periodSnapshots};
}

function earliestFactDate(data:StoreData){
  const dates=[
    ...data.tasks.map(task=>task.createdAt.slice(0,10)),
    ...data.taskEvents.map(event=>event.localDate),
    ...data.dailyFocus.map(focus=>focus.date),
    ...data.readingEvents.map(event=>event.localDate),
    ...data.mediaEvents.map(event=>event.localDate),
  ].filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
  return dates[0];
}
