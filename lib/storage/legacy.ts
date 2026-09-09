import {localDateInTimeZone} from "@/lib/dates";
import {sha256Hex,stableStringify} from "@/lib/crypto/hash";
import {createEmptyStore,type StoreData} from "./migrate";
import type {ReadingCover,ReadingEvent,ReadingItem,ReadingStatus,ReadingType,Task,TaskDomain,TaskEvent,TaskStatus} from "@/types";

type AnyRecord=Record<string,unknown>;
const isRecord=(value:unknown):value is AnyRecord=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const records=(value:unknown)=>Array.isArray(value)?value.filter(isRecord):[];
const string=(value:unknown)=>typeof value==="string"?value:undefined;
const bool=(value:unknown)=>value===true;

const STATUS_MAP:Record<string,TaskStatus>={todo:"open",doing:"open",deferred:"open",someday:"open",done:"done",dropped:"dropped",open:"open"};
const DOMAIN_MAP:Record<string,TaskDomain>={work:"work",study:"study",writing:"creation",creation:"creation",project:"project",life:"life",body:"health",health:"health",relationship:"relationship",reading:"reading",leisure:"leisure",other:"other"};
const READING_STATUS=new Set<ReadingStatus>(["want","reading","finished","paused","dropped"]);
const READING_TYPE=new Set<ReadingType>(["book","article","paper","other"]);

export interface LegacyBackup{
  format:"open-ends-legacy-backup";
  createdAt:string;
  source:"localStorage-v2"|"manual-import";
  timezoneAssumption:string;
  checksum:string;
  store:unknown;
}

export interface LegacyMigrationResult{
  data:StoreData;
  backup:LegacyBackup;
  summary:{tasks:number;taskEvents:number;dailyFocus:number;readingItems:number;excludedAI:boolean;excludedText:boolean};
}

export async function migrateLegacyStore(raw:unknown,options:{timezone:string;now?:string;source?:LegacyBackup["source"]}):Promise<LegacyMigrationResult>{
  if(!isRecord(raw))throw new Error("INVALID_LEGACY_STORE");
  const now=options.now??new Date().toISOString();
  const source=options.source??"localStorage-v2";
  const checksum=await sha256Hex(stableStringify({source,timezoneAssumption:options.timezone,store:raw}));
  const backupPayload={format:"open-ends-legacy-backup" as const,createdAt:now,source,timezoneAssumption:options.timezone,store:raw};
  const backup:LegacyBackup={...backupPayload,checksum};
  const data=createEmptyStore();

  data.tasks=records(raw.tasks).map(value=>mapTask(value,now));
  const taskIds=new Set(data.tasks.map(task=>task.id));
  data.taskEvents=records(raw.events).map(value=>mapTaskEvent(value,options.timezone,now)).filter((event):event is TaskEvent=>Boolean(event&&taskIds.has(event.taskId)));
  data.dailyFocus=buildLegacyDailyFocus(records(raw.tasks),taskIds);
  data.readingItems=records(raw.readingItems).map(value=>mapReading(value,now));
  data.readingEvents=buildReadingEvents(records(raw.readingItems),data.readingItems,options.timezone);
  data.appSettings={
    "migration.legacy.completedAt":now,
    "migration.legacy.checksum":checksum,
    "migration.legacy.timezoneAssumption":options.timezone,
    "migration.legacy.source":source,
  };

  return {data,backup,summary:{
    tasks:data.tasks.length,
    taskEvents:data.taskEvents.length,
    dailyFocus:data.dailyFocus.length,
    readingItems:data.readingItems.length,
    excludedAI:true,
    excludedText:true,
  }};
}

function mapTask(value:AnyRecord,now:string):Task{
  const updatedAt=string(value.updatedAt)??string(value.createdAt)??now;
  const status=STATUS_MAP[string(value.status)??""]??"open";
  return {
    id:string(value.id)??crypto.randomUUID(),
    title:string(value.title)?.trim()||"未命名任务",
    contextPoints:[],
    status,
    domain:DOMAIN_MAP[string(value.domain)??""]??"other",
    plannedDate:string(value.plannedDate),
    createdAt:string(value.createdAt)??updatedAt,
    updatedAt,
    completedAt:status==="done"?string(value.completedAt)??updatedAt:undefined,
    droppedAt:status==="dropped"?updatedAt:undefined,
  };
}

function mapTaskEvent(value:AnyRecord,timezone:string,now:string):TaskEvent|null{
  const legacyType=string(value.type);
  let type:TaskEvent["type"]|undefined;
  if(legacyType==="created"||legacyType==="completed"||legacyType==="restored"||legacyType==="dropped"||legacyType==="rescheduled")type=legacyType;
  if((legacyType==="deferred"||legacyType==="someday")&&(string(value.fromDate)!==string(value.toDate)))type="rescheduled";
  if(!type)return null;
  const occurredAt=string(value.occurredAt)??now;
  return {
    id:string(value.id)??crypto.randomUUID(),
    taskId:string(value.taskId)??"",
    type,
    occurredAt,
    localDate:localDateInTimeZone(occurredAt,timezone),
    timezone,
    fromDate:string(value.fromDate),
    toDate:string(value.toDate),
    metadata:{legacyType},
  };
}

function buildLegacyDailyFocus(tasks:AnyRecord[],taskIds:Set<string>){
  const byDate=new Map<string,{date:string;taskId:string;assignedAt:string}>();
  for(const value of tasks){
    const date=string(value.plannedDate);const taskId=string(value.id);if(!date||!taskId||!taskIds.has(taskId)||!bool(value.isFocus))continue;
    const candidate={date,taskId,assignedAt:string(value.updatedAt)??string(value.createdAt)??new Date(0).toISOString()};
    const current=byDate.get(date);if(!current||candidate.assignedAt>current.assignedAt)byDate.set(date,candidate);
  }
  return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function mapReading(value:AnyRecord,now:string):ReadingItem{
  const statusValue=string(value.status) as ReadingStatus|undefined;
  const typeValue=string(value.type) as ReadingType|undefined;
  return {
    id:string(value.id)??crypto.randomUUID(),
    title:string(value.title)?.trim()||"未命名阅读",
    author:string(value.author),
    type:typeValue&&READING_TYPE.has(typeValue)?typeValue:"other",
    status:statusValue&&READING_STATUS.has(statusValue)?statusValue:"want",
    cover:mapCover(value.cover),
    createdAt:string(value.createdAt)??now,
    updatedAt:string(value.updatedAt)??string(value.createdAt)??now,
  };
}

function mapCover(value:unknown):ReadingCover|undefined{
  if(!isRecord(value))return undefined;
  const provider=value.provider==="google"||value.provider==="openlibrary"?value.provider:undefined;
  const externalId=string(value.externalId);const url=string(value.url);const matchedAt=string(value.matchedAt);
  return provider&&externalId&&url&&matchedAt?{provider,externalId,url,matchedAt}:undefined;
}

function buildReadingEvents(rawItems:AnyRecord[],items:ReadingItem[],timezone:string):ReadingEvent[]{
  const rawById=new Map(rawItems.map(value=>[string(value.id),value]));
  const out:ReadingEvent[]=[];
  for(const item of items){
    out.push(readingEvent(`legacy-reading-added-${item.id}`,item.id,"added",item.createdAt,timezone));
    const raw=rawById.get(item.id);if(!raw)continue;
    const startedAt=string(raw.startedAt);if(startedAt)out.push(readingEvent(`legacy-reading-started-${item.id}`,item.id,"started",asTimestamp(startedAt),timezone));
    const finishedAt=string(raw.finishedAt);if(finishedAt)out.push(readingEvent(`legacy-reading-finished-${item.id}`,item.id,"finished",asTimestamp(finishedAt),timezone));
  }
  return out;
}

function asTimestamp(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T12:00:00.000Z`:value}
function readingEvent(id:string,readingItemId:string,type:ReadingEvent["type"],occurredAt:string,timezone:string):ReadingEvent{return {id,readingItemId,type,occurredAt,localDate:localDateInTimeZone(occurredAt,timezone),timezone}}
