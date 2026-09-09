import {isValidRating,legacyPreferenceRating} from "@/types";
import type {
  AIReview,
  DailyFocus,
  MediaEvent,
  MediaItem,
  PeriodSnapshot,
  ProfileSnapshot,
  ReadingEvent,
  ReadingItem,
  Spark,
  SparkAnalysis,
  SparkRevision,
  SparkLink,
  Task,
  TaskEvent,
} from "@/types";
import {sha256Hex} from "@/lib/crypto/hash";

export const SCHEMA_VERSION=3 as const;
export const LEGACY_STORE_KEYS=["open-ends:store","open-ends:store:v1"] as const;
export const PREVIEW_STORE_KEY="open-ends:preview-store:v1";
export const APP_VERSION="1.0.0";

export interface StoreData{
  schemaVersion:number;
  tasks:Task[];
  taskEvents:TaskEvent[];
  dailyFocus:DailyFocus[];
  sparks:Spark[];
  sparkRevisions:SparkRevision[];
  sparkAnalysis:SparkAnalysis[];
  sparkLinks:SparkLink[];
  readingItems:ReadingItem[];
  readingEvents:ReadingEvent[];
  mediaItems:MediaItem[];
  mediaEvents:MediaEvent[];
  periodSnapshots:PeriodSnapshot[];
  aiReviews:AIReview[];
  profileSnapshots:ProfileSnapshot[];
  appSettings:Record<string,unknown>;
}

export function createEmptyStore():StoreData{return {
  schemaVersion:SCHEMA_VERSION,
  tasks:[],taskEvents:[],dailyFocus:[],
  sparks:[],sparkRevisions:[],sparkAnalysis:[],sparkLinks:[],
  readingItems:[],readingEvents:[],mediaItems:[],mediaEvents:[],
  periodSnapshots:[],aiReviews:[],profileSnapshots:[],appSettings:{},
}}

export const emptyStore=createEmptyStore();

export function clearBusinessData(data:StoreData):StoreData{
  return {...createEmptyStore(),appSettings:{...data.appSettings}};
}

const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null&&!Array.isArray(value);
const asArray=<T,>(value:unknown):T[]=>Array.isArray(value)?value as T[]:[];

export function normalizeStore(raw:unknown):StoreData{
  if(!isRecord(raw))return createEmptyStore();
  return {
    schemaVersion:SCHEMA_VERSION,
    tasks:asArray<Task>(raw.tasks),
    taskEvents:asArray<TaskEvent>(raw.taskEvents),
    dailyFocus:asArray<DailyFocus>(raw.dailyFocus),
    sparks:asArray<Spark>(raw.sparks),
    sparkRevisions:asArray<SparkRevision>(raw.sparkRevisions),
    sparkAnalysis:asArray<SparkAnalysis>(raw.sparkAnalysis).map(item=>({...item,sparkRevision:Number.isInteger(item.sparkRevision)?item.sparkRevision:1})),
    sparkLinks:asArray<SparkLink>(raw.sparkLinks),
    readingItems:asArray<ReadingItem>(raw.readingItems).map(normalizeRatingRecord),
    readingEvents:asArray<ReadingEvent>(raw.readingEvents).map(normalizeRatingRecord),
    mediaItems:asArray<MediaItem>(raw.mediaItems).map(normalizeRatingRecord),
    mediaEvents:asArray<MediaEvent>(raw.mediaEvents).map(normalizeRatingRecord),
    periodSnapshots:asArray<PeriodSnapshot>(raw.periodSnapshots),
    aiReviews:asArray<AIReview>(raw.aiReviews),
    profileSnapshots:asArray<ProfileSnapshot>(raw.profileSnapshots),
    appSettings:isRecord(raw.appSettings)?raw.appSettings:{},
  };
}

function normalizeRatingRecord<T extends { preference?: unknown; rating?: unknown }>(record:T):T{
  const rating=record.rating;
  if(rating!==undefined&&rating!==null)return record;
  const compatibilityRating=legacyPreferenceRating(record.preference as Parameters<typeof legacyPreferenceRating>[0]);
  if(compatibilityRating!==undefined)return {...record,rating:compatibilityRating};
  const withoutRating={...record};
  delete withoutRating.rating;
  return withoutRating as T;
}

export interface StoreBackup{
  schemaVersion:number;
  exportedAt:string;
  appVersion:string;
  data:StoreData;
}

export function serializeStoreBackup(data:StoreData,exportedAt=new Date().toISOString(),appVersion=APP_VERSION):string{
  return JSON.stringify({schemaVersion:SCHEMA_VERSION,exportedAt,appVersion,data},null,2);
}

export async function ensureSparkRevisionHistory(data:StoreData):Promise<StoreData>{
  const missing=data.sparks.filter(spark=>!data.sparkRevisions.some(revision=>revision.sparkId===spark.id));
  if(!missing.length)return data;
  const revisions=await Promise.all(missing.map(async spark=>({
    id:`legacy-${spark.id}-r1`,
    sparkId:spark.id,
    revision:1,
    content:spark.content,
    sourceHash:await sha256Hex(spark.content.trim()),
    createdAt:spark.createdAt,
  })));
  return {...data,sparkRevisions:[...data.sparkRevisions,...revisions]};
}

export async function parseStoreBackup(raw:string):Promise<StoreData|null>{
  try{
    const parsed:unknown=JSON.parse(raw);
    if(!isRecord(parsed))return null;
    const data=isRecord(parsed.data)?parsed.data:parsed;
    if(!("tasks" in data)||!("taskEvents" in data)||typeof data.schemaVersion!=="number"||data.schemaVersion>SCHEMA_VERSION)return null;
    const normalized=await ensureSparkRevisionHistory(normalizeStore(data));
    return isValidStore(normalized)?normalized:null;
  }catch{return null}
}

export function isValidStore(data:StoreData){
  const taskIds=new Set(data.tasks.map(item=>item.id));const readingIds=new Set(data.readingItems.map(item=>item.id));const mediaIds=new Set(data.mediaItems.map(item=>item.id));const sparkIds=new Set(data.sparks.map(item=>item.id));const snapshotIds=new Set(data.periodSnapshots.map(item=>item.id));
  if(taskIds.size!==data.tasks.length||readingIds.size!==data.readingItems.length||mediaIds.size!==data.mediaItems.length||sparkIds.size!==data.sparks.length||snapshotIds.size!==data.periodSnapshots.length)return false;
  const statuses=new Set(["open","done","dropped"]);const domains=new Set(["work","study","creation","project","life","health","relationship","reading","leisure","other"]);const eventTypes=new Set(["created","scheduled","rescheduled","completed","restored","dropped"]);const preferences=new Set(["dislike","neutral","like"]);const isPreference=(value:unknown)=>value===undefined||value===null||preferences.has(value as string);const isRating=(value:unknown)=>value===undefined||value===null||isValidRating(value);const readingStatuses=new Set(["want","reading","finished","paused","dropped"]);const readingTypes=new Set(["book","article","paper","other"]);const readingEventTypes=new Set(["added","started","finished","paused","resumed","dropped","restarted","preference_changed","rating_changed"]);const mediaStatuses=new Set(["want","watching","finished","paused","dropped"]);const mediaTypes=new Set(["movie","tv"]);
  if(data.tasks.some(item=>!item.id||!item.title||!statuses.has(item.status)||!domains.has(item.domain))||data.taskEvents.some(item=>!item.id||!eventTypes.has(item.type)||!item.localDate||!item.timezone))return false;
  if(data.readingItems.some(item=>!item.id||!item.title||!readingTypes.has(item.type)||!readingStatuses.has(item.status)||!isPreference(item.preference)||!isRating(item.rating))||data.readingEvents.some(item=>!item.id||!readingEventTypes.has(item.type)||!item.localDate||!item.timezone||!isPreference(item.preference)||!isRating(item.rating)))return false;
  if(data.mediaItems.some(item=>!item.id||!item.title||!Number.isInteger(item.tmdbId)||item.tmdbId<=0||!mediaTypes.has(item.mediaType)||!mediaStatuses.has(item.status)||!isPreference(item.preference)||!isRating(item.rating))||data.mediaEvents.some(item=>!item.id||!readingEventTypes.has(item.type)||!item.localDate||!item.timezone||!isPreference(item.preference)||!isRating(item.rating)))return false;
  if(data.taskEvents.some(item=>!taskIds.has(item.taskId))||data.dailyFocus.some(item=>!taskIds.has(item.taskId))||new Set(data.dailyFocus.map(item=>item.date)).size!==data.dailyFocus.length)return false;
  if(data.readingEvents.some(item=>!readingIds.has(item.readingItemId))||data.mediaEvents.some(item=>!mediaIds.has(item.mediaItemId))||data.sparkRevisions.some(item=>!sparkIds.has(item.sparkId)||!Number.isInteger(item.revision)||item.revision<1)||data.sparkAnalysis.some(item=>!sparkIds.has(item.sparkId)||!Number.isInteger(item.sparkRevision)||item.sparkRevision<1)||data.sparkLinks.some(item=>!sparkIds.has(item.sparkId)))return false;
  if(new Set(data.sparkRevisions.map(item=>`${item.sparkId}:${item.revision}`)).size!==data.sparkRevisions.length)return false;
  if(new Set(data.sparkLinks.map(item=>`${item.targetType}:${item.targetId}`)).size!==data.sparkLinks.length||data.sparkLinks.some(item=>item.targetType==="task"?!taskIds.has(item.targetId):item.targetType==="reading"?!readingIds.has(item.targetId):!mediaIds.has(item.targetId))||data.aiReviews.some(item=>!snapshotIds.has(item.snapshotId)))return false;
  return true;
}

export function readLegacyStoreFromLocalStorage():unknown|null{
  if(typeof localStorage==="undefined")return null;
  for(const key of LEGACY_STORE_KEYS){
    const raw=localStorage.getItem(key);
    if(!raw)continue;
    try{return JSON.parse(raw)}catch{continue}
  }
  return null;
}
