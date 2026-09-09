import {addDays,fromDateKey,getWeekRange,toDateKey} from "@/lib/dates";

export function latestCompletedProfileBoundaries(today:string){
  const date=fromDateKey(today);
  const weekEnd=toDateKey(addDays(fromDateKey(getWeekRange(date).start),-1));
  const monthEnd=toDateKey(new Date(date.getFullYear(),date.getMonth(),0));
  const yearEnd=`${date.getFullYear()-1}-12-31`;
  return [...new Set([weekEnd,monthEnd,yearEnd])];
}

export function pendingProfileBoundaries(today:string,existingEvidenceEnds:string[]){
  const existing=new Set(existingEvidenceEnds);
  return latestCompletedProfileBoundaries(today).filter(end=>!existing.has(end));
}
