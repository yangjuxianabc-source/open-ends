"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { clearDrafts, createDraftRestoreGuard, draftKeys, useDraftAutosave } from "@/lib/drafts/draft-cache";
import { searchTmdb, type DesktopMediaCandidate } from "@/lib/desktop/tauri-client";
import {searchReadingCandidates} from "@/features/reading/services/candidates";
import { useOpenEnds, type SparkAnalysisResult, type SparkApplyResult } from "@/lib/storage/store";
import { parseSparkAnalysis } from "../services/schema";
import { taskDomainOptions } from "@/features/tasks/components/taskDomains";
import type { Spark, SparkAnalysis } from "@/types";
import type { SparkAnalysisResult as ParsedSparkAnalysis, SparkDraftItem, SparkMediaCandidate, SparkReadingCandidate } from "../types";
import {PageLead} from "@/components/ui/PageLead";
import {SelectMenu} from "@/components/ui/SelectMenu";
import {ContextualTaskTitle} from "@/features/tasks/components/ContextualTaskTitle";
import { ClassicPageScaffold } from "@/ui/editions/classic/layout/ClassicPageScaffold";
import { sparkWorkspaceMode } from "./spark-mode";
import "./spark.css";

type Filter = "all" | "inbox" | "settled" | "archived";

const statusLabels = { inbox: "待整理", organized: "已整理", settled: "已收束", archived: "已归档" } as const;

export function SparkPage() {
  const { data, addSpark, editSpark, analyzeSpark, applySpark, archiveSpark, removeSpark } = useOpenEnds();
  const [selectedId, setSelectedId] = useState<string | undefined>(() => typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("id") ?? undefined);
  const [filter, setFilter] = useState<Filter>("all");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "squeeze" | "detail-entering">("idle");
  const transitionTimerRef = useRef<number | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<{ spark: Spark; linkCount: number }>();
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const composeDraft = useDraftAutosave(draftKeys.sparkMain, content);
  const composeRestoreGuardRef = useRef(createDraftRestoreGuard());
  const composeContentRef = useRef(content);
  useEffect(() => { composeContentRef.current = content; }, [content]);

  const visibleSparks = useMemo(() => data.sparks.filter(spark => filter === "all" || spark.status === filter), [data.sparks, filter]);
  const selected = data.sparks.find(spark => spark.id === selectedId);
  const workspaceMode = sparkWorkspaceMode(selected?.id);
  const transitionClass = transitionPhase === "idle" ? "" : `is-transitioning is-${transitionPhase}`;

  useEffect(() => () => {
    if (transitionTimerRef.current !== undefined) window.clearTimeout(transitionTimerRef.current);
  }, []);

  useEffect(() => {
    const restored = composeDraft.restoredValue;
    if (restored === null || !composeRestoreGuardRef.current.consume(restored, composeContentRef.current === "")) return;
    composeContentRef.current = restored;
    setContent(restored);
    setMessage("已恢复未保存内容");
  }, [composeDraft.restoredValue]);

  function handleComposeChange(nextValue: string) {
    composeRestoreGuardRef.current.markUserEdited();
    composeContentRef.current = nextValue;
    setContent(nextValue);
    if (nextValue.trim() === "") composeDraft.clearDraft();
    setMessage(value => value === "已恢复未保存内容" ? "" : value);
  }

  async function createSpark(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    try {
      const sparkId = await addSpark(content);
      composeDraft.clearDraft();
      setContent("");
      transitionToSpark(sparkId);
      setMessage("已保存");
    } catch (error) {
      setMessage(analysisErrorText(error instanceof Error ? error.message : String(error)));
    }
  }

  function resizeCompose(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 96), 180)}px`;
  }

  useEffect(() => {
    if (composeRef.current) resizeCompose(composeRef.current);
  }, [content]);

  function requestDelete(spark: Spark) {
    const linkCount = data.sparkLinks.filter(link => link.sparkId === spark.id).length;
    setPendingDelete({ spark, linkCount });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const { spark } = pendingDelete;
    removeSpark(spark.id);
    clearDrafts(draftKeys.sparkEditPrefix(spark.id));
    setSelectedId(undefined);
    setMessage("闪念已删除；已分配的内容仍然保留。");
    setPendingDelete(undefined);
  }

  function transitionToSpark(id?: string) {
    if (id === selectedId) return;
    if (transitionTimerRef.current !== undefined) window.clearTimeout(transitionTimerRef.current);
    setTransitionPhase("squeeze");
    transitionTimerRef.current = window.setTimeout(() => {
      setSelectedId(id);
      setTransitionPhase("detail-entering");
      transitionTimerRef.current = window.setTimeout(() => {
        setTransitionPhase("idle");
        transitionTimerRef.current = undefined;
      }, 220);
    }, 140);
  }

  function selectSpark(id: string) {
    transitionToSpark(id);
  }

  return <><ClassicPageScaffold
    lead={<PageLead title="闪念" slogan="把还没成形的念头，先接住。" />}
    pinned={<article className="card spark-compose" id="spark-compose">
      <div className="spark-compose-copy"><span className="tiny-label">Capture</span><p>先写下来，之后再决定去哪里。</p></div>
      <form onSubmit={createSpark}>
        <textarea ref={composeRef} className="field spark-compose-input" value={content} onChange={event => handleComposeChange(event.target.value)} onInput={event => resizeCompose(event.currentTarget)} placeholder="写下这一刻想到的事……" aria-label="原始闪念" />
        <div className="spark-compose-actions"><span className="muted">{selected ? "" : message}</span><Button type="submit" disabled={!content.trim()}>保存原文</Button></div>
      </form>
    </article>}
    contentClassName={`page spark-page ${workspaceMode === "detail" ? "spark-page-detail" : "spark-page-browse"}`}
  >
    <div className={`spark-workspace is-${workspaceMode} ${transitionClass}`}>
      <section className="spark-list-panel">
        <div className="spark-list-fixed-head">
          <div className="section-head spark-list-heading"><div><span>SPARK LIST</span><h2>闪念列表</h2></div><span className="tag">{data.sparks.length} 条</span></div>
          <div className="spark-filters" role="tablist" aria-label="闪念筛选">
            {([["all", "全部"], ["inbox", "待整理"], ["settled", "已收束"], ["archived", "归档"]] as Array<[Filter, string]>).map(([value, label]) => <button type="button" role="tab" key={value} className={filter === value ? "is-active" : ""} aria-selected={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
        </div>
        <div className="spark-scroll-list">
          <div className="spark-list">{visibleSparks.map(spark => <SparkListCard key={spark.id} spark={spark} selected={spark.id === selectedId} linkCount={data.sparkLinks.filter(link => link.sparkId === spark.id).length} settledCount={sparkSettledCount(data, spark.id)} onSelect={() => selectSpark(spark.id)} />)}</div>
          {!visibleSparks.length && <Card className="spark-empty"><strong>{filter === "all" ? "还没有闪念。" : "这个筛选下还没有闪念。"}</strong><p>想到什么，先留下它，不需要当场整理成计划。</p></Card>}
        </div>
      </section>
      {selected ? <section className="spark-detail-column"><SparkDetail key={`${selected.id}:${latestAnalysisId(data, selected.id)}`} spark={selected} data={data} message={message} setMessage={setMessage} busy={busy} setBusy={setBusy} editSpark={editSpark} analyzeSpark={analyzeSpark} applySpark={applySpark} archiveSpark={archiveSpark} removeSelected={() => requestDelete(selected)} onBack={() => transitionToSpark(undefined)} /></section> : null}
    </div>
  </ClassicPageScaffold><ConfirmDialog open={Boolean(pendingDelete)} title="删除这条闪念？" description={pendingDelete?.linkCount ? <>已整理出的 {pendingDelete.linkCount} 个事项会保留，但它们与这条闪念的来源关系会一并移除。</> : "这条闪念和相关历史版本会被删除，无法恢复。"} confirmLabel="删除闪念" onCancel={() => setPendingDelete(undefined)} onConfirm={confirmDelete} /></>;
}

function SparkListCard({ spark, selected, linkCount, settledCount, onSelect }: { spark: Spark; selected: boolean; linkCount: number; settledCount: number; onSelect: () => void }) {
  const preview = sparkPreview(spark.content);
  return <button type="button" className={`spark-list-card ${selected ? "is-selected" : ""}`} onClick={onSelect}>
    <div className="spark-list-card-head"><strong>{preview}</strong><span className={`spark-status spark-status-${spark.status}`}>{statusLabels[spark.status]}</span></div>
    <div className="spark-list-meta"><time>{formatSparkDate(spark.createdAt)}</time>{linkCount > 0 && <span>{linkCount} 个事项 · {settledCount} 已收束</span>}</div>
  </button>;
}

function SparkDetail({ spark, data, message, setMessage, busy, setBusy, editSpark, analyzeSpark, applySpark, archiveSpark, removeSelected, onBack }: { spark: Spark; data: ReturnType<typeof useOpenEnds>["data"]; message: string; setMessage: (value: string) => void; busy: boolean; setBusy: (value: boolean) => void; editSpark:(id:string,content:string)=>Promise<{changed:boolean;revision:number}>; analyzeSpark: (id: string) => Promise<SparkAnalysisResult>; applySpark: (id: string, analysisId: string, items: SparkDraftItem[]) => Promise<SparkApplyResult>; archiveSpark: (id: string) => void; removeSelected: () => void; onBack: () => void }) {
  const revisions=data.sparkRevisions.filter(item=>item.sparkId===spark.id).sort((a,b)=>b.revision-a.revision);
  const currentRevision=revisions[0];
  const latest = data.sparkAnalysis.filter(analysis => analysis.sparkId === spark.id&&analysis.sparkRevision===currentRevision?.revision&&analysis.sourceHash===currentRevision?.sourceHash).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const parsed = latest ? parseLatestAnalysis(latest) : undefined;
  const [drafts, setDrafts] = useState<SparkDraftItem[]>(() => parsed ? toDrafts(parsed) : []);
  const [analysisError] = useState(parsed || !latest ? "" : "这次 AI 结果无法通过严格 JSON 校验，请重新整理。");
  const [mediaResults, setMediaResults] = useState<Record<number, SparkMediaCandidate[]>>({});
  const [searchingMedia, setSearchingMedia] = useState<number>();
  const [readingResults,setReadingResults]=useState<Record<number,SparkReadingCandidate[]>>({});
  const [searchingReading,setSearchingReading]=useState<number>();
  const [editingOriginal,setEditingOriginal]=useState(false);
  const [editedContent,setEditedContent]=useState(spark.content);
  const [showHistory,setShowHistory]=useState(false);
  const editDraft=useDraftAutosave(draftKeys.sparkEdit(spark.id,currentRevision?.revision??1),editedContent);
  const editRestoreGuardRef=useRef(createDraftRestoreGuard());
  const editedContentRef=useRef(editedContent);
  useEffect(()=>{editedContentRef.current=editedContent},[editedContent]);

  useEffect(()=>{
    const restored=editDraft.restoredValue;
    if(restored===null||!editRestoreGuardRef.current.consume(restored,editedContentRef.current===spark.content&&restored!==spark.content))return;
    editedContentRef.current=restored;
    setEditedContent(restored);
    setEditingOriginal(true);
    setMessage("已恢复未保存的原文编辑");
  },[editDraft.restoredValue,spark.content,setMessage]);

  function handleOriginalChange(nextValue:string){
    editRestoreGuardRef.current.markUserEdited();
    editedContentRef.current=nextValue;
    setEditedContent(nextValue);
    if(nextValue===spark.content)editDraft.clearDraft();
    if(message==="已恢复未保存的原文编辑")setMessage("");
  }

  async function saveOriginal(){
    setBusy(true);
    try{
      const result=await editSpark(spark.id,editedContent);
      editDraft.clearDraft();
      setEditingOriginal(false);
      setMessage(result.changed?"内容已更新，需要重新整理。":"原文没有变化。");
    }catch(error){setMessage(analysisErrorText(error instanceof Error?error.message:String(error)))}
    finally{setBusy(false)}
  }

  async function organize() {
    setBusy(true);
    setMessage("");
    const result = await analyzeSpark(spark.id);
    if (result.ok) setMessage("已整理，请检查结果");
    else setMessage(analysisErrorText(result.error));
    setBusy(false);
  }

  async function confirmDraft() {
    if (!latest) return;
    setBusy(true);
    const result = await applySpark(spark.id, latest.id, drafts);
    if (result.ok) setMessage(`已确认 ${result.created.tasks.length + result.created.readings.length + result.created.media.length} 个对象${result.skipped ? `，跳过 ${result.skipped} 个` : ""}。`);
    else setMessage(applyErrorText(result.error));
    setBusy(false);
  }

  async function findMedia(index: number) {
    const item = drafts[index];
    if (!item || item.kind !== "media") return;
    setSearchingMedia(index);
    setMessage("");
    try {
      const candidates = await searchTmdb(item.query, item.mediaTypeHint);
      setMediaResults(previous => ({ ...previous, [index]: candidates.map(toSparkMediaCandidate) }));
      setMessage(candidates.length ? "请选择准确的影视对象；系统不会因为同名而自动盲选。" : "没有找到匹配结果，可以跳过这一条或修改搜索词。");
    } catch (error) {
      setMessage(analysisErrorText(error instanceof Error ? error.message : String(error)));
    } finally {
      setSearchingMedia(undefined);
    }
  }

  async function findReading(index:number){
    const item=drafts[index];if(!item||item.kind!=="reading")return;
    setSearchingReading(index);setMessage("");
    try{
      const candidates=await searchReadingCandidates(item.title,item.author??undefined);
      setReadingResults(previous=>({...previous,[index]:candidates}));
      setMessage(candidates.length?"请选择准确的书籍版本。":"没有找到匹配书籍，可以修改标题后重试。");
    }catch{setMessage("书籍搜索暂时不可用，当前数据没有改变。")}
    finally{setSearchingReading(undefined)}
  }

  function patchDraft(index: number, patch: Record<string, unknown>) {
    setDrafts(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } as SparkDraftItem : item));
  }

  function addTask() {
    setDrafts(items => [...items, { kind: "task", title: "", contextPoints: [], domain: "other", timeBucket: "later", plannedDate: null, focusCandidate: false, confidence: 1, sourceSpan: "用户在确认阶段新增", enabled: true }]);
  }

  function addReading() {
    setDrafts(items => [...items, { kind: "reading", title: "", author: null, readingType: "book", confidence: 1, sourceSpan: "用户在确认阶段新增", enabled: true }]);
  }

  function addMedia(){
    setDrafts(items=>[...items,{kind:"media",query:"",mediaTypeHint:"unknown",confidence:1,sourceSpan:"用户在确认阶段新增",enabled:true}]);
  }

  function resolveAmbiguous(index:number,kind:"reading"|"media"){
    setDrafts(items=>items.map((item,itemIndex)=>{
      if(itemIndex!==index||item.kind!=="ambiguous")return item;
      return kind==="reading"
        ? {kind:"reading",title:item.title,author:null,readingType:"book",candidateRequired:true,confidence:item.confidence,sourceSpan:item.sourceSpan,enabled:true}
        : {kind:"media",query:item.title,mediaTypeHint:"unknown",confidence:item.confidence,sourceSpan:item.sourceSpan,enabled:true};
    }));
  }

  const linkRows = data.sparkLinks.filter(link => link.sparkId === spark.id).map(link => ({ link, title: targetTitle(data, link.targetType, link.targetId) }));
  const confirmed = Boolean(latest?.appliedAt);

  return <Card className="spark-detail-card">
    <div className="spark-detail-head"><button type="button" className="spark-back" onClick={onBack}>← 闪念列表</button></div>
    <div className="spark-detail-meta"><div className="spark-detail-title"><span className={`spark-status spark-status-${spark.status}`}>{statusLabels[spark.status]}</span><time>{formatSparkDate(spark.createdAt)}</time></div><div className="spark-detail-actions">{editingOriginal ? <Button type="button" variant="ghost" onClick={() => { setEditingOriginal(false); setEditedContent(spark.content); }}>取消编辑</Button> : <Button type="button" variant="ghost" onClick={() => { setEditedContent(spark.content); setEditingOriginal(true); }}>编辑</Button>}{spark.status !== "archived" && <Button variant="ghost" type="button" onClick={() => archiveSpark(spark.id)}>归档</Button>}<Button variant="danger" type="button" onClick={removeSelected}><span className="tool-icon" aria-hidden="true">×</span><span>删除</span></Button></div></div>
    <section className="spark-original-section">
      <div className="spark-original-head"><strong>原文</strong>{revisions.length>1&&<Button type="button" variant="ghost" onClick={()=>setShowHistory(value=>!value)}>{showHistory?"收起历史":"查看历史版本"}</Button>}</div>
      {editingOriginal?<div className="spark-original-editor"><textarea className="field" value={editedContent} onChange={event=>handleOriginalChange(event.target.value)} autoFocus/><div><Button type="button" onClick={()=>void saveOriginal()} disabled={busy||!editedContent.trim()}>保存新版本</Button><Button type="button" variant="ghost" onClick={()=>setEditingOriginal(false)}>取消</Button></div></div>:<blockquote className="spark-original">{spark.content}</blockquote>}
      {showHistory&&<div className="spark-revision-history">{revisions.map(revision=><details key={revision.id} open={revision.revision===currentRevision?.revision}><summary>版本 {revision.revision} · {formatSparkDate(revision.createdAt)}{revision.revision===currentRevision?.revision?" · 当前":""}</summary><p>{revision.content}</p></details>)}</div>}
    </section>
    {message && <p className="spark-message" role="status">{message}</p>}

    <section className="spark-section"><div className="spark-section-head"><div><h2>整理结果</h2></div>{latest && !confirmed && <Button type="button" variant="secondary" onClick={organize} disabled={busy}>{busy ? "正在整理…" : "重新整理"}</Button>}</div>
      {!latest && <div className="spark-action-card"><p>原文已经安全保存。AI 只会生成待确认建议，不会直接写入任务或阅读记录。</p><Button type="button" onClick={organize} disabled={busy}>{busy ? "正在整理…" : "开始 AI 整理"}</Button></div>}
      {analysisError && <div className="spark-error" role="alert">{analysisError}<Button type="button" variant="ghost" onClick={organize} disabled={busy}>重新整理</Button></div>}
      {latest && parsed && <>
        <div className="spark-analysis-meta">{confirmed && <span>已确认于 {formatSparkDate(latest.appliedAt!)}</span>}</div>
        {parsed.sourceType === "idea_only" && <div className="spark-idea-note">这条内容更像一个还未成形的想法，暂不制造 Todo。原文会继续保留。</div>}
        {!confirmed && <>
          <div className="spark-draft-list">{drafts.map((item, index) => <DraftEditor key={`${latest.id}-${index}`} item={item} index={index} mediaResults={mediaResults[index] ?? []} readingResults={readingResults[index]??[]} searchingMedia={searchingMedia === index} searchingReading={searchingReading===index} onPatch={patchDraft} onRemove={() => setDrafts(items => items.filter((_, itemIndex) => itemIndex !== index))} onFindMedia={() => void findMedia(index)} onFindReading={()=>void findReading(index)} onChooseMedia={candidate => patchDraft(index, { candidate })} onChooseReading={candidate=>patchDraft(index,{candidate,title:candidate.title,author:candidate.authors.join("、")||null})} onResolveAmbiguous={kind=>resolveAmbiguous(index,kind)} />)}</div>
          <div className="spark-add-actions"><Button type="button" variant="ghost" onClick={addTask}>＋ 添加任务</Button><Button type="button" variant="ghost" onClick={addReading}>＋ 添加阅读</Button><Button type="button" variant="ghost" onClick={addMedia}>＋ 添加影视</Button></div>
          <div className="spark-confirm-bar"><span className="muted">检查这些建议，确认后再加入对应记录。</span><Button type="button" onClick={confirmDraft} disabled={busy}>{busy ? "正在保存…" : "全部确认"}</Button></div>
        </>}
        {confirmed && <p className="spark-confirmed-note">这次整理已经确认。若原始想法继续变化，可以重新生成一份新的分析结果；旧结果不会覆盖历史。</p>}
      </>}
    </section>

    <section className="spark-section"><div className="spark-section-head"><div><h2>分配</h2></div><span className="tag">{linkRows.length} 个</span></div>{linkRows.length ? <ul className="spark-link-list">{linkRows.map(({ link, title }) => <li key={link.id}><span className={`spark-kind spark-kind-${link.targetType}`}>{targetLabel(link.targetType)}</span>{link.targetType === "task" ? <Link href="/open"><ContextualTaskTitle title={title}/></Link> : link.targetType === "reading" ? <Link href="/reading">{title}</Link> : <span>{title}</span>}</li>)}</ul> : <p className="muted">还没有分配内容。</p>}</section>
  </Card>;
}

function DraftEditor({ item, index, mediaResults, readingResults, searchingMedia, searchingReading, onPatch, onRemove, onFindMedia, onFindReading, onChooseMedia, onChooseReading, onResolveAmbiguous }: { item: SparkDraftItem; index: number; mediaResults: SparkMediaCandidate[]; readingResults:SparkReadingCandidate[]; searchingMedia: boolean; searchingReading:boolean; onPatch: (index: number, patch: Record<string, unknown>) => void; onRemove: () => void; onFindMedia: () => void; onFindReading:()=>void; onChooseMedia: (candidate: SparkMediaCandidate) => void; onChooseReading:(candidate:SparkReadingCandidate)=>void; onResolveAmbiguous:(kind:"reading"|"media")=>void }) {
  return <article className={`spark-draft spark-draft-${item.kind} ${item.enabled ? "" : "is-disabled"}`}>
    <div className="spark-draft-head"><label className="spark-enable"><input type="checkbox" checked={item.enabled} onChange={event => onPatch(index, { enabled: event.target.checked })} /><span>{targetLabel(item.kind)}</span></label><span className="spark-confidence">置信度 {Math.round(item.confidence * 100)}%</span><Button type="button" variant="ghost" onClick={onRemove}>移除</Button></div>
    {item.kind==="ambiguous"&&<div className="spark-ambiguous"><h3>{item.title}</h3><p>这可能是阅读对象，也可能是影视作品。</p><div><Button type="button" variant="secondary" onClick={()=>onResolveAmbiguous("reading")}>作为阅读查找</Button><Button type="button" variant="secondary" onClick={()=>onResolveAmbiguous("media")}>作为影视查找</Button></div></div>}
    {item.kind === "task" && <>
      <Input value={item.title} onChange={event => onPatch(index, { title: event.target.value })} placeholder="任务标题" aria-label={`Task ${index + 1} 标题`} />
      <label className="label">Task Context <textarea className="field spark-context-input" value={item.contextPoints.join("\n")} onChange={event => onPatch(index, { contextPoints: event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean).slice(0, 5) })} placeholder="每行一个帮助恢复语境的要点" /></label>
      <div className="spark-draft-fields"><SelectMenu label="领域" value={item.domain} onChange={value=>onPatch(index,{domain:value})} options={taskDomainOptions.map(([value,label])=>({value,label}))}/><label className="label">计划日期<input className="field" type="date" value={item.plannedDate ?? ""} onChange={event => onPatch(index, { plannedDate: event.target.value || null, timeBucket: event.target.value ? "today" : item.timeBucket })} /></label></div>
      <label className="spark-check"><input type="checkbox" checked={item.focusCandidate} onChange={event => onPatch(index, { focusCandidate: event.target.checked })} />建议设为今日 Focus（最多一条）</label>
      <small className="spark-source">来源：{item.sourceSpan}</small>
    </>}
    {item.kind === "reading" && <>
      <Input value={item.title} onChange={event => onPatch(index, { title: event.target.value })} placeholder="阅读对象标题" aria-label={`Reading ${index + 1} 标题`} />
      <div className="spark-draft-fields"><label className="label">作者<input className="field" value={item.author ?? ""} onChange={event => onPatch(index, { author: event.target.value || null })} placeholder="作者（可选）" /></label><SelectMenu label="类型" value={item.readingType} onChange={value=>onPatch(index,{readingType:value})} options={[{value:"book",label:"书籍"},{value:"article",label:"文章"},{value:"paper",label:"论文"},{value:"other",label:"其他"}]}/></div>
      {item.readingType==="book"&&<div className="spark-reading-search"><Button type="button" variant="secondary" onClick={onFindReading} disabled={!item.title.trim()||searchingReading}>{searchingReading?"搜索中…":"查找书籍"}</Button>{item.candidate&&<span>已选择：{item.candidate.title}</span>}</div>}
      {!item.candidate&&readingResults.length>0&&<div className="spark-reading-results">{readingResults.map(candidate=><button type="button" key={`${candidate.provider}-${candidate.externalId}`} onClick={()=>onChooseReading(candidate)}><strong>{candidate.title}</strong><span>{candidate.authors.join("、")||"作者未知"}</span></button>)}</div>}
      <small className="spark-source">来源：{item.sourceSpan}</small>
    </>}
    {item.kind === "media" && <>
      <Input value={item.query} onChange={event => onPatch(index, { query: event.target.value, candidate: undefined })} placeholder="影视搜索词" aria-label={`Media ${index + 1} 搜索词`} />
      <div className="spark-media-search"><SelectMenu label="类型提示" value={item.mediaTypeHint} onChange={value=>onPatch(index,{mediaTypeHint:value,candidate:undefined})} options={[{value:"unknown",label:"电影或剧集"},{value:"movie",label:"电影"},{value:"tv",label:"剧集"}]}/><Button type="button" variant="secondary" onClick={onFindMedia} disabled={!item.query.trim() || searchingMedia}>{searchingMedia ? "搜索中…" : "搜索作品"}</Button></div>
      {item.candidate ? <div className="spark-selected-media"><strong>{item.candidate.title}</strong><span>{item.candidate.mediaType === "movie" ? "电影" : "剧集"}{item.candidate.releaseYear ? ` · ${item.candidate.releaseYear}` : ""}</span><Button type="button" variant="ghost" onClick={() => onPatch(index, { candidate: undefined })}>更换</Button></div> : mediaResults.length > 0 && <div className="spark-media-results">{mediaResults.map(candidate => <button type="button" key={`${candidate.mediaType}-${candidate.tmdbId}`} onClick={() => onChooseMedia(candidate)}><strong>{candidate.title}</strong><span>{candidate.mediaType === "movie" ? "电影" : "剧集"}{candidate.releaseYear ? ` · ${candidate.releaseYear}` : ""}</span></button>)}</div>}
      <small className="spark-source">来源：{item.sourceSpan} · 必须人工确认具体作品</small>
    </>}
  </article>;
}

function parseLatestAnalysis(analysis: SparkAnalysis): ParsedSparkAnalysis | undefined {
  try { return parseSparkAnalysis(JSON.parse(analysis.resultJson)); } catch { return undefined; }
}

function latestAnalysisId(data: ReturnType<typeof useOpenEnds>["data"], sparkId: string) {
  const revision=data.sparkRevisions.filter(item=>item.sparkId===sparkId).sort((a,b)=>b.revision-a.revision)[0];
  return `${revision?.revision??"none"}:${data.sparkAnalysis.filter(analysis => analysis.sparkId === sparkId&&analysis.sparkRevision===revision?.revision&&analysis.sourceHash===revision?.sourceHash).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id ?? "none"}`;
}

function toDrafts(result: ParsedSparkAnalysis): SparkDraftItem[] {
  return result.items.map(item => item.kind === "task" ? { ...item, enabled: true } : item.kind === "reading" ? { ...item, enabled: true, readingType: "book" } : { ...item, enabled: true });
}

function toSparkMediaCandidate(candidate: DesktopMediaCandidate): SparkMediaCandidate { return { ...candidate }; }

function sparkSettledCount(data: ReturnType<typeof useOpenEnds>["data"], sparkId: string) {
  return data.sparkLinks.filter(link => link.sparkId === sparkId).filter(link => link.targetType === "task" ? data.tasks.find(item => item.id === link.targetId)?.status === "done" || data.tasks.find(item => item.id === link.targetId)?.status === "dropped" : link.targetType === "reading" ? data.readingItems.find(item => item.id === link.targetId)?.status === "finished" || data.readingItems.find(item => item.id === link.targetId)?.status === "dropped" : data.mediaItems.find(item => item.id === link.targetId)?.status === "finished" || data.mediaItems.find(item => item.id === link.targetId)?.status === "dropped").length;
}

function targetTitle(data: ReturnType<typeof useOpenEnds>["data"], kind: "task" | "reading" | "media", id: string) {
  if (kind === "task") return data.tasks.find(item => item.id === id)?.title ?? "已移除的任务";
  if (kind === "reading") return data.readingItems.find(item => item.id === id)?.title ?? "已移除的阅读对象";
  return data.mediaItems.find(item => item.id === id)?.title ?? "已移除的影视对象";
}

function targetLabel(kind: "task" | "reading" | "media" | "ambiguous") { return kind === "task" ? "任务" : kind === "reading" ? "阅读" : kind==="media" ? "影视" : "待确认"; }
function sparkPreview(content:string){
  const lines=content.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  return (lines.slice(0,3).join("\n")||content.replace(/\s+/g," ").trim()).slice(0,220)||"未命名闪念";
}
function formatSparkDate(value: string) { return new Date(value).toLocaleDateString("zh-CN", { month: "long", day: "numeric" }); }
function analysisErrorText(error: string) { return ({ DESKTOP_RUNTIME_REQUIRED: "AI 整理需要在 Open Ends 桌面应用中进行。原文已经保存。", CREDENTIAL_NOT_CONFIGURED: "还没有配置 DeepSeek API Key。原文已经保存，可以稍后在设置中配置。", INVALID_API_KEY: "DeepSeek API Key 无效。原文已经保存，请在设置中更新密钥。", SPARK_SCHEMA_INVALID: "AI 返回的结果不符合严格格式。原文已经保存，可以重新整理。", UPSTREAM_INVALID_RESPONSE: "AI 返回内容无法读取。原文已经保存，可以稍后重试。", UPSTREAM_UNAVAILABLE: "暂时无法连接 AI 服务。原文已经保存，可以稍后重试。", UPSTREAM_RATE_LIMITED: "AI 服务暂时限流。原文已经保存，可以稍后重试。", STORAGE_WRITE_FAILED: "保存到本地失败，请稍后重试。" } as Record<string, string>)[error] ?? `整理失败：${error}`; }
function applyErrorText(error: string) { return ({ SPARK_EMPTY_TITLE: "请填写标题后确认", STORAGE_WRITE_FAILED: "保存到本地失败，请稍后重试。", SPARK_ANALYSIS_ALREADY_APPLIED: "这份整理结果已经确认。", SPARK_ANALYSIS_STALE:"原文已经更新，请先重新整理。",SPARK_AMBIGUOUS_UNRESOLVED:"请先选择模糊作品作为阅读或影视查找。",SPARK_READING_CANDIDATE_REQUIRED:"请先选择准确的书籍版本。",SPARK_MEDIA_CANDIDATE_REQUIRED:"请先选择准确的影视作品。", SPARK_ANALYSIS_NOT_FOUND: "找不到这份整理结果，请重新打开闪念。", SPARK_NOT_FOUND: "找不到这条闪念。" } as Record<string, string>)[error] ?? `确认失败：${error}`; }
