const pad=(n:number)=>String(n).padStart(2,"0");
export const toDateKey=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
export const fromDateKey=(key:string)=>{const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d)};
export const addDays=(date:Date,n:number)=>{const next=new Date(date);next.setDate(next.getDate()+n);return next};
export function getWeekRange(date:Date){const day=date.getDay();const start=addDays(new Date(date.getFullYear(),date.getMonth(),date.getDate()),day===0?-6:1-day);return {start:toDateKey(start),end:toDateKey(addDays(start,6))}}
export interface CalendarDay { date:string; day:number; isCurrentMonth:boolean }
export function getMonthGrid(year:number,month:number):CalendarDay[]{const first=new Date(year,month,1);const offset=(first.getDay()+6)%7;const start=addDays(first,-offset);return Array.from({length:42},(_,i)=>{const d=addDays(start,i);return {date:toDateKey(d),day:d.getDate(),isCurrentMonth:d.getMonth()===month}})}
export const isDateInRange=(value:string,start:string,end:string)=>value>=start&&value<=end;
export const formatChineseDate=(date:Date)=>{
  const datePart=new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric"}).format(date);
  const weekday=new Intl.DateTimeFormat("zh-CN",{weekday:"long"}).format(date);
  return `${datePart} · ${weekday}`;
};

export const currentTimeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";

export function localDateInTimeZone(value:string|Date,timeZone:string):string{
  const date=typeof value==="string"?new Date(value):value;
  if(Number.isNaN(date.getTime()))throw new Error("INVALID_TIMESTAMP");
  const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const byType=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function monthRange(year:number,month:number){
  const start=`${year}-${pad(month+1)}-01`;
  return {start,end:toDateKey(new Date(year,month+1,0))};
}

export function yearRange(year:number){return {start:`${year}-01-01`,end:`${year}-12-31`}}
