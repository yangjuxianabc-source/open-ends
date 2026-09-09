"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {addDays,currentTimeZone,localDateInTimeZone,toDateKey} from "@/lib/dates";
import {reconcileEndedSnapshots} from "@/features/reviews/services/backfill";
import {buildPeriodSnapshot,createSnapshotRevision} from "@/features/reviews/services/snapshots";
import {plannedDateEventType,withRescheduledDate} from "@/features/tasks/services/history";
import {clearBusinessData,createEmptyStore,LEGACY_STORE_KEYS,readLegacyStoreFromLocalStorage,type StoreData} from "./migrate";
import {migrateLegacyStore} from "./legacy";
import {createRepository,type OpenEndsRepository} from "./repository";
import {emitStoreChanged,getCredentialStatus,listenStoreChanged} from "@/lib/desktop/tauri-client";
import {analyzeSparkContent} from "@/features/spark/services/analysis";
import {applySparkDraft} from "@/features/spark/services/apply";
import {linkedSparkIds,reconcileSparkStatus,reconcileLinkedSparks} from "@/features/spark/services/lifecycle";
import {readingTransition} from "@/features/reading/services/events";
import {mediaTransition} from "@/features/media/services/events";
import {buildProfileEvidencePack} from "@/features/ai-insights/services/evidence";
import {generateProfile,nextProfileRevision} from "@/features/ai-insights/services/generation";
import {pendingProfileBoundaries} from "@/features/ai-insights/services/boundaries";
import {generateReview,generateReviewWithRetry,nextReviewRevision} from "@/features/reviews/services/generation";
import {buildReviewGenerationInput} from "@/features/reviews/services/comparison";
import {appearanceSettingsToAppSettings,type AppearanceSettings} from "@/lib/settings/appearance";
import {sha256Hex} from "@/lib/crypto/hash";
import {ratingChangeEvent} from "./rating";
import type {SparkDraftItem} from "@/features/spark/types";
import type {SparkPromptContext} from "@/features/spark/services/prompt";
import {isValidRating} from "@/types";
import type {MediaCandidate,MediaEvent,MediaItem,PeriodType,Preference,Rating,ReadingEvent,ReadingEventType,ReadingItem,ReadingType,Spark,SparkAnalysis,Task,TaskDomain,TaskEvent,TaskStatus} from "@/types";

const id=()=>crypto.randomUUID();
function errorMessage(cause:unknown,fallback:string){
  if(cause instanceof Error&&cause.message)return cause.message;
  if(typeof cause==="string"&&cause.trim())return cause;
  if(cause&&typeof cause==="object"){
    const record=cause as Record<string,unknown>;
    for(const value of [record.message,record.error,record.reason])if(typeof value==="string"&&value.trim())return value;
    try{const serialized=JSON.stringify(cause);if(serialized&&serialized!=="{}")return serialized}catch{}
  }
  return fallback;
}
export type MigrationState={status:"idle"|"running"|"completed"|"failed";message?:string;backupPath?:string};
export type SparkApplyResult={ok:true;created:{tasks:string[];readings:string[];media:string[]};skipped:number}|{ok:false;error:string};
export type SparkAnalysisResult={ok:true;analysisId:string}|{ok:false;error:string};
export type AIActionResult={ok:true;id:string}|{ok:false;error:string};
export type SnapshotActionResult={ok:true;id:string;created:boolean}|{ok:false;error:string};
export type PeriodReviewRequest={periodType:PeriodType;periodKey:string;periodStart:string;periodEnd:string};
type PersistResult={ok:true}|{ok:false;error:unknown};
type StoreTransform=(current:StoreData)=>StoreData;
type PendingCommit={transform:StoreTransform;resolve:(result:PersistResult)=>void};
type ReadingUpdate=Partial<Pick<ReadingItem,"title"|"author"|"status"|"preference"|"cover">>&{rating?:Rating|null};
type MediaUpdate=Partial<Pick<MediaItem,"status"|"preference">>&{rating?:Rating|null};

interface Actions{
  data:StoreData;ready:boolean;storageKind?:OpenEndsRepository["kind"];error?:string;migration:MigrationState;
  setAppearanceSettings:(next:AppearanceSettings)=>void;
  restore:(data:StoreData)=>void;
  clearAllData:()=>Promise<void>;
  addTask:(title:string,date?:string,domain?:TaskDomain)=>void;
  removeTask:(id:string)=>void;
  updateTask:(id:string,patch:Partial<Pick<Task,"title"|"domain"|"plannedDate"|"contextPoints">>)=>void;
  transitionTask:(id:string,status:TaskStatus)=>void;
  rescheduleTask:(id:string,date?:string)=>void;
  setDailyFocus:(date:string,taskId?:string)=>void;
  addReading:(title:string,author:string,type:ReadingType)=>string;
  updateReading:(id:string,patch:ReadingUpdate)=>void;
  removeReading:(id:string)=>void;
  addMedia:(candidate:MediaCandidate)=>string;
  updateMedia:(id:string,patch:MediaUpdate)=>void;
  removeMedia:(id:string)=>void;
  addSpark:(content:string)=>Promise<string>;
  editSpark:(id:string,content:string)=>Promise<{changed:boolean;revision:number}>;
  analyzeSpark:(id:string)=>Promise<SparkAnalysisResult>;
  applySpark:(id:string,analysisId:string,items:SparkDraftItem[])=>Promise<SparkApplyResult>;
  ensurePeriodSnapshot:(periodType:PeriodType,periodKey:string,periodStart:string,periodEnd:string)=>Promise<SnapshotActionResult>;
  generateAIReview:(snapshotId:string)=>Promise<AIActionResult>;
  generatePeriodReview:(request:PeriodReviewRequest)=>Promise<AIActionResult>;
  generateProfileSnapshot:(evidenceEnd?:string)=>Promise<AIActionResult>;
  archiveSpark:(id:string)=>void;
  removeSpark:(id:string)=>void;
}

const Context=createContext<Actions|null>(null);

export function StoreProvider({children}:{children:React.ReactNode}){
  const [data,setData]=useState<StoreData>(createEmptyStore);
  const [ready,setReady]=useState(false);
  const [storageKind,setStorageKind]=useState<OpenEndsRepository["kind"]>();
  const [error,setError]=useState<string>();
  const [migration,setMigration]=useState<MigrationState>({status:"idle"});
  const dataRef=useRef(data);const repositoryRef=useRef<OpenEndsRepository|undefined>(undefined);const generationRef=useRef(0);const persistQueue=useRef(Promise.resolve());
  const readyRef=useRef(false);const pendingCommitsRef=useRef<PendingCommit[]>([]);const externalReloadPendingRef=useRef(false);
  const windowOriginRef=useRef("");
  const boundaryCheckRef=useRef(false);

  useEffect(()=>{let active=true;let unlisten=()=>{};let removeRefreshListeners=()=>{};let initializationPending:PendingCommit[]=[];windowOriginRef.current=crypto.randomUUID();(async()=>{
    try{
      const repository=await createRepository();repositoryRef.current=repository;if(active)setStorageKind(repository.kind);
      const refreshFromStorage=()=>{
        if(!active||!readyRef.current)return;
        persistQueue.current=persistQueue.current.catch(()=>undefined).then(async()=>{
          if(!active||!readyRef.current)return;
          const refreshed=await repository.load();if(!active)return;dataRef.current=refreshed;setData(refreshed);
        }).catch(cause=>{if(active)setError(errorMessage(cause,"STORAGE_RELOAD_FAILED"))});
      };
      const onVisibilityChange=()=>{if(document.visibilityState==="visible")void refreshFromStorage()};
      window.addEventListener("focus",refreshFromStorage);
      window.addEventListener("pageshow",refreshFromStorage);
      document.addEventListener("visibilitychange",onVisibilityChange);
      removeRefreshListeners=()=>{window.removeEventListener("focus",refreshFromStorage);window.removeEventListener("pageshow",refreshFromStorage);document.removeEventListener("visibilitychange",onVisibilityChange)};
      if(repository.kind==="sqlite"){
        try{unlisten=await listenStoreChanged(origin=>{
          if(!active||origin===windowOriginRef.current)return;
          if(!readyRef.current){externalReloadPendingRef.current=true;return;}
          persistQueue.current=persistQueue.current.then(async()=>{
            const refreshed=await repository.load();if(!active)return;dataRef.current=refreshed;setData(refreshed);
          }).catch(cause=>setError(errorMessage(cause,"STORAGE_RELOAD_FAILED")));
        })}catch(cause){if(active)setError(errorMessage(cause,"STORAGE_LISTENER_FAILED"))}
      }
      let loaded=await repository.load();
      const legacy=readLegacyStoreFromLocalStorage();
      if(legacy&&!loaded.appSettings["migration.legacy.completedAt"]&&isFactuallyEmpty(loaded)){
        if(active)setMigration({status:"running",message:"正在备份并迁移旧版数据…"});
        const result=await migrateLegacyStore(legacy,{timezone:currentTimeZone()});
        const backupPath=await repository.writeLegacyBackup(result.backup);
        await repository.replace(result.data);loaded=result.data;
        for(const key of LEGACY_STORE_KEYS)localStorage.removeItem(key);
        if(active)setMigration({status:"completed",backupPath,message:`已迁移 ${result.summary.tasks} 条任务，旧 AI 与主观文本完整保存在 legacy-backup.json。`});
      }
      const today=toDateKey(new Date());const reconciled=await reconcileEndedSnapshots(loaded,today,new Date().toISOString());
      if(reconciled!==loaded){await repository.replace(reconciled);loaded=reconciled}
      initializationPending=pendingCommitsRef.current.splice(0);
      for(const pending of initializationPending)loaded=pending.transform(loaded);
      dataRef.current=loaded;if(active)setData(loaded);
      while(initializationPending.length){
        await repository.replace(loaded);if(repository.kind==="sqlite")await emitStoreChanged(windowOriginRef.current);
        const latePending=pendingCommitsRef.current.splice(0);if(!latePending.length)break;
        initializationPending.push(...latePending);for(const pending of latePending)loaded=pending.transform(loaded);dataRef.current=loaded;if(active)setData(loaded);
      }
      readyRef.current=true;if(active)setReady(true);
      for(const pending of initializationPending)pending.resolve({ok:true});
      initializationPending=[];
      if(externalReloadPendingRef.current){
        externalReloadPendingRef.current=false;
        const refreshed=await repository.load();if(active){dataRef.current=refreshed;setData(refreshed)}
      }
    }catch(cause){
      for(const pending of [...initializationPending,...pendingCommitsRef.current.splice(0)])pending.resolve({ok:false,error:cause});
      initializationPending=[];readyRef.current=true;
      const message=errorMessage(cause,"STORAGE_INITIALIZATION_FAILED");if(active){setError(message);setMigration(state=>state.status==="running"?{status:"failed",message}:state);setReady(true)}
    }
  })();return()=>{active=false;unlisten();removeRefreshListeners()}},[]);

  const schedulePersist=useCallback(():Promise<PersistResult>=>{
    const generation=++generationRef.current;
    const pending=persistQueue.current.then(async()=>{
      if(generation!==generationRef.current)return;
      const repository=repositoryRef.current;if(!repository)throw new Error("STORAGE_NOT_READY");
      const latest=dataRef.current;
      const withSnapshots=await reconcileEndedSnapshots(latest,toDateKey(new Date()),new Date().toISOString());
      if(generation!==generationRef.current)return;
      dataRef.current=withSnapshots;if(withSnapshots!==latest)setData(withSnapshots);
      await repository.replace(withSnapshots);
      if(repository.kind==="sqlite")await emitStoreChanged(windowOriginRef.current);
    });
    const result=pending.then(
      ()=>({ok:true as const}),
      cause=>{setError(errorMessage(cause,"STORAGE_WRITE_FAILED"));return {ok:false as const,error:cause};},
    );
    persistQueue.current=result.then(()=>undefined);
    return result;
  },[]);

  const commit=useCallback((transform:StoreTransform):Promise<PersistResult>|undefined=>{
    if(!readyRef.current)return new Promise<PersistResult>(resolve=>pendingCommitsRef.current.push({transform,resolve}));
    const next=transform(dataRef.current);if(next===dataRef.current)return;
    dataRef.current=next;setData(next);return schedulePersist();
  },[schedulePersist]);

  const value=useMemo<Actions>(()=>({
    data,ready,storageKind,error,migration,
     setAppearanceSettings:next=>{commit(current=>({...current,appSettings:{...current.appSettings,...appearanceSettingsToAppSettings(next)}}));},
     restore:next=>commit(()=>next),
     clearAllData:async()=>{
       const persisted=commit(current=>clearBusinessData(current));
       if(persisted){const result=await persisted;if(!result.ok)throw result.error instanceof Error?result.error:new Error("STORAGE_WRITE_FAILED")}
     },
    addTask:(title,date=toDateKey(new Date()),domain="other")=>commit(current=>{
      const now=new Date().toISOString();const task:Task={id:id(),title:title.trim(),contextPoints:[],status:"open",domain,plannedDate:date||undefined,createdAt:now,updatedAt:now};
      return {...current,tasks:[task,...current.tasks],taskEvents:[taskEvent(task.id,"created",now,{toDate:task.plannedDate}),...current.taskEvents]};
    }),
    removeTask:taskId=>commit(current=>{
      const now=new Date().toISOString();const sparkIds=linkedSparkIds(current,"task",taskId);
      let next={...current,tasks:current.tasks.filter(item=>item.id!==taskId),taskEvents:current.taskEvents.filter(item=>item.taskId!==taskId),dailyFocus:current.dailyFocus.filter(item=>item.taskId!==taskId),sparkLinks:current.sparkLinks.filter(item=>!(item.targetType==="task"&&item.targetId===taskId))};
      for(const sparkId of sparkIds)next=reconcileSparkStatus(next,sparkId,now);return next;
    }),
    updateTask:(taskId,patch)=>commit(current=>{
      const task=current.tasks.find(item=>item.id===taskId);if(!task)return current;
      if(Object.prototype.hasOwnProperty.call(patch,"plannedDate")&&patch.plannedDate!==task.plannedDate)return reschedule(current,task,patch.plannedDate,{...patch,plannedDate:undefined});
      const updated={...task,...patch,updatedAt:new Date().toISOString()};return {...current,tasks:current.tasks.map(item=>item.id===taskId?updated:item)};
    }),
    transitionTask:(taskId,status)=>commit(current=>{
      const task=current.tasks.find(item=>item.id===taskId);if(!task||task.status===status)return current;
      const now=new Date().toISOString();const type=status==="done"?"completed":status==="dropped"?"dropped":"restored";
      const updated:Task={...task,status,updatedAt:now,completedAt:status==="done"?now:undefined,droppedAt:status==="dropped"?now:undefined};
      return reconcileLinkedSparks({...current,tasks:current.tasks.map(item=>item.id===taskId?updated:item),taskEvents:[taskEvent(taskId,type,now),...current.taskEvents]},"task",taskId,now);
    }),
    rescheduleTask:(taskId,date)=>commit(current=>{const task=current.tasks.find(item=>item.id===taskId);return task?reschedule(current,task,date):current}),
    setDailyFocus:(date,taskId)=>commit(current=>({...current,dailyFocus:taskId?[{date,taskId,assignedAt:new Date().toISOString()},...current.dailyFocus.filter(item=>item.date!==date)]:current.dailyFocus.filter(item=>item.date!==date)})),
    addReading:(title,author,type)=>{const readingId=id();commit(current=>{const now=new Date().toISOString();const item:ReadingItem={id:readingId,title:title.trim(),author:author.trim()||undefined,type,status:"want",createdAt:now,updatedAt:now};return {...current,readingItems:[item,...current.readingItems],readingEvents:[readingEvent(readingId,"added",now),...current.readingEvents]}});return readingId},
    updateReading:(itemId,patch)=>commit(current=>{
      const item=current.readingItems.find(value=>value.id===itemId);if(!item)return current;const now=new Date().toISOString();const events=[...current.readingEvents];
      if(patch.status&&patch.status!==item.status){const type=readingTransition(item.status,patch.status);if(type)events.unshift(readingEvent(itemId,type,now))}
      if(Object.prototype.hasOwnProperty.call(patch,"preference")&&patch.preference!==item.preference)events.unshift(readingEvent(itemId,"preference_changed",now,patch.preference));
      const hasRating=Object.prototype.hasOwnProperty.call(patch,"rating");const nextRating=patch.rating??undefined;
      if(hasRating&&nextRating!==undefined&&!isValidRating(nextRating))return current;
      const updatedBase={...item,...patch,updatedAt:now};
      const updatedReading=hasRating&&nextRating===undefined?withoutRating(updatedBase):updatedBase;
      const ratingChange=hasRating?ratingChangeEvent(item.rating,nextRating):undefined;
      if(ratingChange)events.unshift(readingEvent(itemId,ratingChange.type,now,undefined,ratingChange.rating));
      return reconcileLinkedSparks({...current,readingItems:current.readingItems.map(value=>value.id===itemId?updatedReading:value),readingEvents:events},"reading",itemId,now);
    }),
    removeReading:itemId=>commit(current=>{
      const now=new Date().toISOString();const sparkIds=linkedSparkIds(current,"reading",itemId);
      let next={...current,readingItems:current.readingItems.filter(item=>item.id!==itemId),readingEvents:current.readingEvents.filter(event=>event.readingItemId!==itemId),sparkLinks:current.sparkLinks.filter(item=>!(item.targetType==="reading"&&item.targetId===itemId))};
      for(const sparkId of sparkIds)next=reconcileSparkStatus(next,sparkId,now);return next;
    }),
    addMedia:candidate=>{const mediaId=id();commit(current=>{const now=new Date().toISOString();const item:MediaItem={id:mediaId,...candidate,status:"want",createdAt:now,updatedAt:now};return {...current,mediaItems:[item,...current.mediaItems],mediaEvents:[mediaEvent(mediaId,"added",now),...current.mediaEvents]}});return mediaId},
    updateMedia:(itemId,patch)=>commit(current=>{
      const item=current.mediaItems.find(value=>value.id===itemId);if(!item)return current;const hasRating=Object.prototype.hasOwnProperty.call(patch,"rating");const nextRating=patch.rating??undefined;if(hasRating&&nextRating!==undefined&&!isValidRating(nextRating))return current;const now=new Date().toISOString();const updatedBase={...item,...patch,updatedAt:now};const updatedMedia=hasRating&&nextRating===undefined?withoutRating(updatedBase):updatedBase;const events=[...current.mediaEvents];
      if(patch.status&&patch.status!==item.status){const type=mediaTransition(item.status,patch.status);if(type)events.unshift(mediaEvent(itemId,type,now))}
      if(Object.prototype.hasOwnProperty.call(patch,"preference")&&patch.preference!==item.preference)events.unshift(mediaEvent(itemId,"preference_changed",now,patch.preference));
      const ratingChange=hasRating?ratingChangeEvent(item.rating,nextRating):undefined;
      if(ratingChange)events.unshift(mediaEvent(itemId,ratingChange.type,now,undefined,ratingChange.rating));
      return reconcileLinkedSparks({...current,mediaItems:current.mediaItems.map(value=>value.id===itemId?updatedMedia:value),mediaEvents:events},"media",itemId,now);
    }),
    removeMedia:itemId=>commit(current=>{
      const now=new Date().toISOString();const sparkIds=linkedSparkIds(current,"media",itemId);
      let next={...current,mediaItems:current.mediaItems.filter(item=>item.id!==itemId),mediaEvents:current.mediaEvents.filter(event=>event.mediaItemId!==itemId),sparkLinks:current.sparkLinks.filter(item=>!(item.targetType==="media"&&item.targetId===itemId))};
      for(const sparkId of sparkIds)next=reconcileSparkStatus(next,sparkId,now);return next;
    }),
    addSpark:async content=>{const contentValue=content.trim();if(!contentValue)return "";const sparkId=id();const now=new Date().toISOString();const sourceHash=await sha256Hex(contentValue);const persisted=commit(current=>{const spark:Spark={id:sparkId,content:contentValue,status:"inbox",createdAt:now};return {...current,sparks:[spark,...current.sparks],sparkRevisions:[{id:id(),sparkId,revision:1,content:contentValue,sourceHash,createdAt:now},...current.sparkRevisions]}});if(persisted&&!(await persisted).ok)throw new Error("STORAGE_WRITE_FAILED");return sparkId},
    editSpark:async(sparkId,content)=>{
      const value=content.trim();if(!value)throw new Error("SPARK_CONTENT_EMPTY");
      const spark=dataRef.current.sparks.find(item=>item.id===sparkId);if(!spark)throw new Error("SPARK_NOT_FOUND");
      const latest=Math.max(0,...dataRef.current.sparkRevisions.filter(item=>item.sparkId===sparkId).map(item=>item.revision));
      if(value===spark.content.trim())return {changed:false,revision:latest||1};
      const sourceHash=await sha256Hex(value);const now=new Date().toISOString();const revision=(latest||1)+1;
      const persisted=commit(current=>({...current,sparks:current.sparks.map(item=>item.id===sparkId?{...item,content:value}:item),sparkRevisions:[{id:id(),sparkId,revision,content:value,sourceHash,createdAt:now},...current.sparkRevisions]}));
      if(persisted&&!(await persisted).ok)throw new Error("STORAGE_WRITE_FAILED");
      return {changed:true,revision};
    },
    analyzeSpark:async sparkId=>{
      const spark=dataRef.current.sparks.find(item=>item.id===sparkId);if(!spark)return {ok:false,error:"SPARK_NOT_FOUND"};
      const revision=dataRef.current.sparkRevisions.filter(item=>item.sparkId===sparkId).sort((a,b)=>b.revision-a.revision)[0];if(!revision)return {ok:false,error:"SPARK_REVISION_NOT_FOUND"};
      const context:SparkPromptContext={today:toDateKey(new Date()),tasks:dataRef.current.tasks.filter(item=>item.status==="open").slice(0,80).map(item=>({title:item.title,status:item.status,plannedDate:item.plannedDate})),readings:dataRef.current.readingItems.slice(0,40).map(item=>({title:item.title,author:item.author,status:item.status})),media:dataRef.current.mediaItems.slice(0,40).map(item=>({title:item.title,mediaType:item.mediaType,status:item.status}))};
      try{const analyzed=await analyzeSparkContent(spark.content,context);const analysis:SparkAnalysis={id:id(),sparkId,sparkRevision:revision.revision,provider:analyzed.provider,model:analyzed.model,sourceHash:analyzed.sourceHash,resultJson:analyzed.resultJson,createdAt:new Date().toISOString()};const persisted=commit(current=>current.sparks.some(item=>item.id===sparkId)?{...current,sparkAnalysis:[analysis,...current.sparkAnalysis],sparks:current.sparks.map(item=>item.id===sparkId?{...item,processedAt:item.processedAt??analysis.createdAt}:item)}:current);if(persisted&&!(await persisted).ok)return {ok:false,error:"STORAGE_WRITE_FAILED"};return {ok:true,analysisId:analysis.id};}catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)}}
    },
    applySpark:async(sparkId,analysisId,items)=>{
      try{const result=applySparkDraft(dataRef.current,sparkId,analysisId,items,{now:new Date().toISOString(),today:toDateKey(new Date())});const persisted=commit(()=>result.data);if(persisted&&!(await persisted).ok)return {ok:false,error:"STORAGE_WRITE_FAILED"};return {ok:true,created:result.created,skipped:result.skipped};}catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)}}
    },
    ensurePeriodSnapshot:async(periodType,periodKey,periodStart,periodEnd)=>{
      try{
        const draft=await buildPeriodSnapshot(dataRef.current,periodType,periodStart,periodEnd,periodKey);
        const revision=createSnapshotRevision(draft,dataRef.current.periodSnapshots,id(),new Date().toISOString());
        const existing=dataRef.current.periodSnapshots.filter(item=>item.periodType===periodType&&item.periodKey===periodKey).sort((a,b)=>b.revision-a.revision)[0];
        const target=revision??existing;
        if(!target)return {ok:false,error:"SNAPSHOT_NOT_FOUND"};
        if(revision){
          const persisted=commit(current=>({...current,periodSnapshots:[revision,...current.periodSnapshots]}));
          if(persisted&&!(await persisted).ok)return {ok:false,error:"STORAGE_WRITE_FAILED"};
        }
        return {ok:true,id:target.id,created:Boolean(revision)};
      }catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)}}
    },
    generateAIReview:async snapshotId=>{
      const snapshot=dataRef.current.periodSnapshots.find(item=>item.id===snapshotId);if(!snapshot)return {ok:false,error:"SNAPSHOT_NOT_FOUND"};
      try{const input=buildReviewGenerationInput(dataRef.current,snapshot);const generated=await generateReview(snapshot,input);const review={...generated,revision:nextReviewRevision(dataRef.current.aiReviews,snapshot.id)};const persisted=commit(current=>current.periodSnapshots.some(item=>item.id===snapshot.id)?{...current,aiReviews:[review,...current.aiReviews]}:current);if(persisted&&!(await persisted).ok)return {ok:false,error:"STORAGE_WRITE_FAILED"};return {ok:true,id:review.id};}catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)}}
    },
    generatePeriodReview:async request=>{
      try{
        let working=dataRef.current;
        const draft=await buildPeriodSnapshot(working,request.periodType,request.periodStart,request.periodEnd,request.periodKey);
        const revision=createSnapshotRevision(draft,working.periodSnapshots,id(),new Date().toISOString());
        const existing=working.periodSnapshots.filter(item=>item.periodType===request.periodType&&item.periodKey===request.periodKey).sort((a,b)=>b.revision-a.revision)[0];
        const snapshot=revision??existing;
        if(!snapshot)return {ok:false,error:"SNAPSHOT_NOT_FOUND"};
        if(revision){
          working={...working,periodSnapshots:[revision,...working.periodSnapshots]};
          const persisted=commit(()=>working);
          if(persisted&&!(await persisted).ok)return {ok:false,error:"STORAGE_WRITE_FAILED"};
        }
        const input=buildReviewGenerationInput(working,snapshot);
        const generated=await generateReviewWithRetry(snapshot,input);
        const review={...generated,revision:nextReviewRevision(dataRef.current.aiReviews,snapshot.id)};
        const persisted=commit(current=>current.periodSnapshots.some(item=>item.id===snapshot.id)?{...current,aiReviews:[review,...current.aiReviews]}:current);
        if(persisted&&!(await persisted).ok)return {ok:false,error:"STORAGE_WRITE_FAILED"};
        return {ok:true,id:review.id};
      }catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)}}
    },
    generateProfileSnapshot:async evidenceEnd=>{
      const now=new Date().toISOString();const pack=buildProfileEvidencePack(dataRef.current,evidenceEnd??toDateKey(new Date()));
      try{const generated=await generateProfile(pack,now);const profile={...generated,revision:nextProfileRevision(dataRef.current.profileSnapshots,pack.evidenceEnd)};const persisted=commit(current=>({...current,profileSnapshots:[profile,...current.profileSnapshots]}));if(persisted&&!(await persisted).ok)return {ok:false,error:"STORAGE_WRITE_FAILED"};return {ok:true,id:profile.id};}catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)}}
    },
    archiveSpark:sparkId=>commit(current=>{const spark=current.sparks.find(item=>item.id===sparkId);if(!spark||spark.status==="archived")return current;const now=new Date().toISOString();return {...current,sparks:current.sparks.map(item=>item.id===sparkId?{...item,status:"archived",archivedAt:now}:item)}}),
    removeSpark:sparkId=>commit(current=>({...current,sparks:current.sparks.filter(item=>item.id!==sparkId),sparkRevisions:current.sparkRevisions.filter(item=>item.sparkId!==sparkId),sparkAnalysis:current.sparkAnalysis.filter(item=>item.sparkId!==sparkId),sparkLinks:current.sparkLinks.filter(item=>item.sparkId!==sparkId)})),
  }),[commit,data,error,migration,ready,storageKind]);

  const profileGenerationRef=useRef(value.generateProfileSnapshot);
  useEffect(()=>{profileGenerationRef.current=value.generateProfileSnapshot},[value.generateProfileSnapshot]);

  useEffect(()=>{
    if(!ready||storageKind!=="sqlite"||boundaryCheckRef.current)return;
    boundaryCheckRef.current=true;let active=true;
    void (async()=>{
      try{
        const credential=await getCredentialStatus("deepseek");if(!credential.configured||!active)return;
        const today=toDateKey(new Date());
        const pending=pendingProfileBoundaries(today,dataRef.current.profileSnapshots.map(item=>item.evidenceEnd));
        for(const evidenceEnd of pending){if(!active)return;await profileGenerationRef.current(evidenceEnd)}
      }catch{/* Boundary generation is best-effort and retries on a later launch. */}
    })();
    return()=>{active=false};
  },[ready,storageKind]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function taskEvent(taskId:string,type:TaskEvent["type"],occurredAt:string,extra:Partial<TaskEvent>={}):TaskEvent{const timezone=currentTimeZone();return {id:id(),taskId,type,occurredAt,localDate:localDateInTimeZone(occurredAt,timezone),timezone,...extra}}
function readingEvent(readingItemId:string,type:ReadingEventType,occurredAt:string,preference?:Preference,rating?:Rating):ReadingEvent{const timezone=currentTimeZone();return {id:id(),readingItemId,type,...(preference===undefined?{}:{preference}),...(rating===undefined?{}:{rating}),occurredAt,localDate:localDateInTimeZone(occurredAt,timezone),timezone}}
function mediaEvent(mediaItemId:string,type:MediaEvent["type"],occurredAt:string,preference?:Preference,rating?:Rating):MediaEvent{const timezone=currentTimeZone();return {id:id(),mediaItemId,type,...(preference===undefined?{}:{preference}),...(rating===undefined?{}:{rating}),occurredAt,localDate:localDateInTimeZone(occurredAt,timezone),timezone}}
function withoutRating<T extends {rating?:unknown}>(value:T):Omit<T,"rating">{const rest={...value};delete rest.rating;return rest}
function reschedule(current:StoreData,task:Task,date?:string,additional:Partial<Task>={}):StoreData{const plannedDate=date||undefined;if(plannedDate===task.plannedDate)return current;const now=new Date().toISOString();const updated=withRescheduledDate({...task,...additional},plannedDate,now);const eventType=plannedDateEventType(task.plannedDate,plannedDate);return {...current,tasks:current.tasks.map(item=>item.id===task.id?updated:item),taskEvents:[taskEvent(task.id,eventType,now,{fromDate:task.plannedDate,toDate:plannedDate}),...current.taskEvents]}}
function isFactuallyEmpty(data:StoreData){return !data.tasks.length&&!data.taskEvents.length&&!data.readingItems.length&&!data.mediaItems.length&&!data.sparks.length}

export function useOpenEnds(){const value=useContext(Context);if(!value)throw new Error("useOpenEnds must be used inside StoreProvider");return value}
export const deferDates={tomorrow:()=>toDateKey(addDays(new Date(),1)),nextWeek:()=>toDateKey(addDays(new Date(),7))};
