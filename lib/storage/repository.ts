import Database from "@tauri-apps/plugin-sql";
import {createEmptyStore,ensureSparkRevisionHistory,normalizeStore,PREVIEW_STORE_KEY,serializeStoreBackup,type StoreData,isValidStore} from "./migrate";
import type {LegacyBackup} from "./legacy";
import type {
  AIReview,DailyFocus,MediaEvent,MediaItem,PeriodSnapshot,ProfileSnapshot,ReadingEvent,ReadingItem,
  Spark,SparkAnalysis,SparkLink,SparkRevision,Task,TaskEvent,
} from "@/types";
import { legacyPreferenceRating, type Preference } from "@/types";

export interface OpenEndsRepository{
  readonly kind:"sqlite"|"browser-preview";
  load():Promise<StoreData>;
  replace(data:StoreData):Promise<void>;
  writeLegacyBackup(backup:LegacyBackup):Promise<string>;
}
interface SqlStatement{sql:string;values:unknown[]}

export async function createRepository():Promise<OpenEndsRepository>{
  if(typeof window!=="undefined"&&"__TAURI_INTERNALS__" in window)return SQLiteRepository.open();
  return new BrowserPreviewRepository();
}

class BrowserPreviewRepository implements OpenEndsRepository{
  readonly kind="browser-preview" as const;
  async load(){
    if(typeof localStorage==="undefined")return createEmptyStore();
    const raw=localStorage.getItem(PREVIEW_STORE_KEY);if(!raw)return createEmptyStore();
    try{return ensureSparkRevisionHistory(normalizeStore(JSON.parse(raw)))}catch{return createEmptyStore()}
  }
  async replace(data:StoreData){if(typeof localStorage!=="undefined")localStorage.setItem(PREVIEW_STORE_KEY,JSON.stringify(data))}
  async writeLegacyBackup(backup:LegacyBackup){
    const key=`open-ends:preview-legacy-backup:${backup.checksum}`;
    if(typeof localStorage!=="undefined"&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(backup));
    return key;
  }
}

class SQLiteRepository implements OpenEndsRepository{
  readonly kind="sqlite" as const;
  private constructor(private readonly db:Database){}
  static async open(){return new SQLiteRepository(await Database.load("sqlite:open-ends.db"))}

  async load():Promise<StoreData>{
    const data=createEmptyStore();
    data.tasks=(await this.rows("SELECT * FROM tasks")).map(mapTask);
    data.taskEvents=(await this.rows("SELECT * FROM task_events")).map(mapTaskEvent);
    data.dailyFocus=(await this.rows("SELECT * FROM daily_focus")).map(mapDailyFocus);
    data.sparks=(await this.rows("SELECT * FROM sparks")).map(mapSpark);
    data.sparkRevisions=(await this.rows("SELECT * FROM spark_revisions")).map(mapSparkRevision);
    data.sparkAnalysis=(await this.rows("SELECT * FROM spark_analysis")).map(mapSparkAnalysis);
    data.sparkLinks=(await this.rows("SELECT * FROM spark_links")).map(mapSparkLink);
    data.readingItems=(await this.rows("SELECT * FROM reading_items")).map(mapReadingItem);
    data.readingEvents=(await this.rows("SELECT * FROM reading_events")).map(mapReadingEvent);
    data.mediaItems=(await this.rows("SELECT * FROM media_items")).map(mapMediaItem);
    data.mediaEvents=(await this.rows("SELECT * FROM media_events")).map(mapMediaEvent);
    data.periodSnapshots=(await this.rows("SELECT * FROM period_snapshots")).map(mapPeriodSnapshot);
    data.aiReviews=(await this.rows("SELECT * FROM ai_reviews")).map(mapAIReview);
    data.profileSnapshots=(await this.rows("SELECT * FROM profile_snapshots")).map(mapProfileSnapshot);
    for(const row of await this.rows("SELECT key,value_json FROM app_settings"))data.appSettings[text(row.key)]=json(row.value_json,null);
    return normalizeStore(data);
  }

  async replace(data:StoreData):Promise<void>{
    if(!isValidStore(data))throw new Error("INVALID_STORE");
    const statements:SqlStatement[]=[];const add=(sql:string,values:unknown[]=[])=>statements.push({sql,values});
    for(const table of ["ai_reviews","profile_snapshots","period_snapshots","spark_links","spark_analysis","spark_revisions","task_events","daily_focus","reading_events","media_events","tasks","reading_items","media_items","sparks","app_settings"])add(`DELETE FROM ${table}`);
    for(const task of data.tasks)add("INSERT INTO tasks(id,title,context_points_json,status,domain,planned_date,created_at,updated_at,completed_at,dropped_at) VALUES (?,?,?,?,?,?,?,?,?,?)",[task.id,task.title,JSON.stringify(task.contextPoints),task.status,task.domain,task.plannedDate??null,task.createdAt,task.updatedAt,task.completedAt??null,task.droppedAt??null]);
    for(const event of data.taskEvents)add("INSERT INTO task_events(id,task_id,type,occurred_at,local_date,timezone,from_date,to_date,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)",[event.id,event.taskId,event.type,event.occurredAt,event.localDate,event.timezone,event.fromDate??null,event.toDate??null,JSON.stringify(event.metadata??{})]);
    for(const focus of data.dailyFocus)add("INSERT INTO daily_focus(date,task_id,assigned_at) VALUES (?,?,?)",[focus.date,focus.taskId,focus.assignedAt]);
    for(const spark of data.sparks)add("INSERT INTO sparks(id,content,status,created_at,processed_at,settled_at,archived_at) VALUES (?,?,?,?,?,?,?)",[spark.id,spark.content,spark.status,spark.createdAt,spark.processedAt??null,spark.settledAt??null,spark.archivedAt??null]);
    for(const revision of data.sparkRevisions)add("INSERT INTO spark_revisions(id,spark_id,revision,content,source_hash,created_at) VALUES (?,?,?,?,?,?)",[revision.id,revision.sparkId,revision.revision,revision.content,revision.sourceHash,revision.createdAt]);
    for(const analysis of data.sparkAnalysis)add("INSERT INTO spark_analysis(id,spark_id,spark_revision,provider,model,source_hash,result_json,created_at,applied_at) VALUES (?,?,?,?,?,?,?,?,?)",[analysis.id,analysis.sparkId,analysis.sparkRevision,analysis.provider,analysis.model,analysis.sourceHash,analysis.resultJson,analysis.createdAt,analysis.appliedAt??null]);
    for(const item of data.readingItems)add("INSERT INTO reading_items(id,title,author,type,status,preference,rating,cover_provider,cover_external_id,cover_url,cover_matched_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",[item.id,item.title,item.author??null,item.type,item.status,item.preference??null,item.rating??null,item.cover?.provider??null,item.cover?.externalId??null,item.cover?.url??null,item.cover?.matchedAt??null,item.createdAt,item.updatedAt]);
    for(const event of data.readingEvents)add("INSERT INTO reading_events(id,reading_item_id,type,preference,rating,occurred_at,local_date,timezone) VALUES (?,?,?,?,?,?,?,?)",[event.id,event.readingItemId,event.type,event.preference??null,event.rating??null,event.occurredAt,event.localDate,event.timezone]);
    for(const item of data.mediaItems)add("INSERT INTO media_items(id,tmdb_id,media_type,title,original_title,release_date,release_year,poster_path,genre_ids_json,original_language,status,preference,rating,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[item.id,item.tmdbId,item.mediaType,item.title,item.originalTitle??null,item.releaseDate??null,item.releaseYear??null,item.posterPath??null,JSON.stringify(item.genreIds),item.originalLanguage??null,item.status,item.preference??null,item.rating??null,item.createdAt,item.updatedAt]);
    for(const event of data.mediaEvents)add("INSERT INTO media_events(id,media_item_id,type,preference,rating,occurred_at,local_date,timezone) VALUES (?,?,?,?,?,?,?,?)",[event.id,event.mediaItemId,event.type,event.preference??null,event.rating??null,event.occurredAt,event.localDate,event.timezone]);
    for(const snapshot of data.periodSnapshots)add("INSERT INTO period_snapshots(id,period_type,period_key,period_start,period_end,revision,source_hash,facts_json,created_at,supersedes_id) VALUES (?,?,?,?,?,?,?,?,?,?)",[snapshot.id,snapshot.periodType,snapshot.periodKey,snapshot.periodStart,snapshot.periodEnd,snapshot.revision,snapshot.sourceHash,snapshot.factsJson,snapshot.createdAt,snapshot.supersedesId??null]);
    for(const review of data.aiReviews)add("INSERT INTO ai_reviews(id,snapshot_id,review_type,revision,provider,model,source_hash,content,generated_at) VALUES (?,?,?,?,?,?,?,?,?)",[review.id,review.snapshotId,review.reviewType,review.revision,review.provider,review.model,review.sourceHash,review.content,review.generatedAt]);
    for(const profile of data.profileSnapshots)add("INSERT INTO profile_snapshots(id,evidence_end,revision,provider,model,source_hash,evidence_json,content,generated_at) VALUES (?,?,?,?,?,?,?,?,?)",[profile.id,profile.evidenceEnd,profile.revision,profile.provider,profile.model,profile.sourceHash,profile.evidenceJson,profile.content,profile.generatedAt]);
    for(const link of data.sparkLinks)add("INSERT INTO spark_links(id,spark_id,target_type,target_id,created_at) VALUES (?,?,?,?,?)",[link.id,link.sparkId,link.targetType,link.targetId,link.createdAt]);
    const updatedAt=new Date().toISOString();for(const [key,value] of Object.entries(data.appSettings))add("INSERT INTO app_settings(key,value_json,updated_at) VALUES (?,?,?)",[key,JSON.stringify(value),updatedAt]);
    const {invoke}=await import("@tauri-apps/api/core");await invoke("execute_transaction",{statements});
    await invoke("write_data_backup",{contents:serializeStoreBackup(data),manual:false});
  }

  async writeLegacyBackup(backup:LegacyBackup){
    const {invoke}=await import("@tauri-apps/api/core");
    return invoke<string>("write_legacy_backup",{contents:JSON.stringify(backup,null,2),checksum:backup.checksum});
  }
  private rows(sql:string){return this.db.select<Record<string,unknown>[]>(sql)}
}

const text=(value:unknown)=>String(value??"");
const optionalText=(value:unknown)=>value===null||value===undefined?undefined:String(value);
const number=(value:unknown)=>Number(value);
const optionalNumber=(value:unknown)=>value===null||value===undefined?undefined:Number(value);
const rating=(value:unknown,preference:unknown)=>optionalNumber(value)??legacyPreferenceRating(optionalText(preference) as Preference|undefined);
function json<T>(value:unknown,fallback:T):T{try{return JSON.parse(text(value)) as T}catch{return fallback}}

const mapTask=(row:Record<string,unknown>):Task=>({id:text(row.id),title:text(row.title),contextPoints:json(row.context_points_json,[]),status:text(row.status) as Task["status"],domain:text(row.domain) as Task["domain"],plannedDate:optionalText(row.planned_date),createdAt:text(row.created_at),updatedAt:text(row.updated_at),completedAt:optionalText(row.completed_at),droppedAt:optionalText(row.dropped_at)});
const mapTaskEvent=(row:Record<string,unknown>):TaskEvent=>({id:text(row.id),taskId:text(row.task_id),type:text(row.type) as TaskEvent["type"],occurredAt:text(row.occurred_at),localDate:text(row.local_date),timezone:text(row.timezone),fromDate:optionalText(row.from_date),toDate:optionalText(row.to_date),metadata:json(row.metadata_json,{})});
const mapDailyFocus=(row:Record<string,unknown>):DailyFocus=>({date:text(row.date),taskId:text(row.task_id),assignedAt:text(row.assigned_at)});
const mapSpark=(row:Record<string,unknown>):Spark=>({id:text(row.id),content:text(row.content),status:text(row.status) as Spark["status"],createdAt:text(row.created_at),processedAt:optionalText(row.processed_at),settledAt:optionalText(row.settled_at),archivedAt:optionalText(row.archived_at)});
const mapSparkRevision=(row:Record<string,unknown>):SparkRevision=>({id:text(row.id),sparkId:text(row.spark_id),revision:number(row.revision),content:text(row.content),sourceHash:text(row.source_hash),createdAt:text(row.created_at)});
const mapSparkAnalysis=(row:Record<string,unknown>):SparkAnalysis=>({id:text(row.id),sparkId:text(row.spark_id),sparkRevision:number(row.spark_revision)||1,provider:text(row.provider),model:text(row.model),sourceHash:text(row.source_hash),resultJson:text(row.result_json),createdAt:text(row.created_at),appliedAt:optionalText(row.applied_at)});
const mapSparkLink=(row:Record<string,unknown>):SparkLink=>({id:text(row.id),sparkId:text(row.spark_id),targetType:text(row.target_type) as SparkLink["targetType"],targetId:text(row.target_id),createdAt:text(row.created_at)});
const mapReadingItem=(row:Record<string,unknown>):ReadingItem=>({id:text(row.id),title:text(row.title),author:optionalText(row.author),type:text(row.type) as ReadingItem["type"],status:text(row.status) as ReadingItem["status"],preference:optionalText(row.preference) as ReadingItem["preference"],rating:rating(row.rating,row.preference),cover:row.cover_provider?{provider:text(row.cover_provider) as "google"|"openlibrary",externalId:text(row.cover_external_id),url:text(row.cover_url),matchedAt:text(row.cover_matched_at)}:undefined,createdAt:text(row.created_at),updatedAt:text(row.updated_at)});
const mapReadingEvent=(row:Record<string,unknown>):ReadingEvent=>({id:text(row.id),readingItemId:text(row.reading_item_id),type:text(row.type) as ReadingEvent["type"],preference:optionalText(row.preference) as ReadingEvent["preference"],rating:optionalNumber(row.rating),occurredAt:text(row.occurred_at),localDate:text(row.local_date),timezone:text(row.timezone)});
const mapMediaItem=(row:Record<string,unknown>):MediaItem=>({id:text(row.id),tmdbId:number(row.tmdb_id),mediaType:text(row.media_type) as MediaItem["mediaType"],title:text(row.title),originalTitle:optionalText(row.original_title),releaseDate:optionalText(row.release_date),releaseYear:row.release_year===null?undefined:number(row.release_year),posterPath:optionalText(row.poster_path),genreIds:json(row.genre_ids_json,[]),originalLanguage:optionalText(row.original_language),status:text(row.status) as MediaItem["status"],preference:optionalText(row.preference) as MediaItem["preference"],rating:rating(row.rating,row.preference),createdAt:text(row.created_at),updatedAt:text(row.updated_at)});
const mapMediaEvent=(row:Record<string,unknown>):MediaEvent=>({id:text(row.id),mediaItemId:text(row.media_item_id),type:text(row.type) as MediaEvent["type"],preference:optionalText(row.preference) as MediaEvent["preference"],rating:optionalNumber(row.rating),occurredAt:text(row.occurred_at),localDate:text(row.local_date),timezone:text(row.timezone)});
const mapPeriodSnapshot=(row:Record<string,unknown>):PeriodSnapshot=>({id:text(row.id),periodType:text(row.period_type) as PeriodSnapshot["periodType"],periodKey:text(row.period_key),periodStart:text(row.period_start),periodEnd:text(row.period_end),revision:number(row.revision),sourceHash:text(row.source_hash),factsJson:text(row.facts_json),createdAt:text(row.created_at),supersedesId:optionalText(row.supersedes_id)});
const mapAIReview=(row:Record<string,unknown>):AIReview=>({id:text(row.id),snapshotId:text(row.snapshot_id),reviewType:text(row.review_type) as AIReview["reviewType"],revision:number(row.revision),provider:text(row.provider),model:text(row.model),sourceHash:text(row.source_hash),content:text(row.content),generatedAt:text(row.generated_at)});
const mapProfileSnapshot=(row:Record<string,unknown>):ProfileSnapshot=>({id:text(row.id),evidenceEnd:text(row.evidence_end),revision:number(row.revision),provider:text(row.provider),model:text(row.model),sourceHash:text(row.source_hash),evidenceJson:text(row.evidence_json),content:text(row.content),generatedAt:text(row.generated_at)});
