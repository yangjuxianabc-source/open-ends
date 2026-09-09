"use client";

import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/Button";
import {Card} from "@/components/ui/Card";
import {Input} from "@/components/ui/Input";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {createDraftRestoreGuard,draftKeys,useDraftAutosave} from "@/lib/drafts/draft-cache";
import {isDesktopRuntime,searchTmdb} from "@/lib/desktop/tauri-client";
import {useOpenEnds} from "@/lib/storage/store";
import type {MediaCandidate,MediaType} from "@/types";
import {MediaItemCard} from "./MediaItemCard";
import {PageLead} from "@/components/ui/PageLead";
import {SelectMenu} from "@/components/ui/SelectMenu";
import {ClassicPageScaffold} from "@/ui/editions/classic/layout/ClassicPageScaffold";

export function MediaPage(){
  const {data,addMedia,removeMedia}=useOpenEnds();
  const [desktop,setDesktop]=useState(false);
  const [query,setQuery]=useState("");
  const [hint,setHint]=useState<MediaType|"unknown">("unknown");
  const [results,setResults]=useState<MediaCandidate[]>([]);
  const [searching,setSearching]=useState(false);
  const [message,setMessage]=useState("");
  const [pendingDelete,setPendingDelete]=useState<{id:string;title:string}>();
  const searchDraft=useDraftAutosave(draftKeys.mediaSearch,{query,hint},{shouldSave:value=>Boolean(value.query.trim())});
  const searchRestoreGuardRef=useRef(createDraftRestoreGuard());
  const queryRef=useRef(query);
  useEffect(()=>{queryRef.current=query},[query]);
  useEffect(()=>{Promise.resolve().then(()=>setDesktop(isDesktopRuntime()))},[]);
  useEffect(()=>{
    const restored=searchDraft.restoredValue;
    if(restored===null||!searchRestoreGuardRef.current.consume(restored,queryRef.current===""))return;
    queryRef.current=restored.query??"";setQuery(queryRef.current);setHint(restored.hint??"unknown");setMessage("已恢复未保存搜索条件");
  },[searchDraft.restoredValue]);

  function handleQueryChange(nextValue:string){
    searchRestoreGuardRef.current.markUserEdited();queryRef.current=nextValue;setQuery(nextValue);
    if(nextValue.trim()==="")searchDraft.clearDraft();
    setMessage(value=>value==="已恢复未保存搜索条件"?"":value);
  }

  function handleHintChange(nextValue:string){
    searchRestoreGuardRef.current.markUserEdited();setHint(nextValue as MediaType|"unknown");
  }

  async function search(event:React.FormEvent){
    event.preventDefault();
    if(!desktop){setMessage("影视搜索需要在 Open Ends 桌面应用中使用；浏览器开发预览不会读取安全凭据。");return}
    if(!query.trim())return;
    setSearching(true);setMessage("");setResults([]);
    try{const candidates=await searchTmdb(query.trim(),hint);setResults(candidates);setMessage(candidates.length?"请选择一个具体作品加入。":"暂未找到匹配的电影或剧集。")}catch(error){setMessage(searchErrorText(error))}finally{setSearching(false)}
  }

  function choose(candidate:MediaCandidate){
    if(data.mediaItems.some(item=>item.tmdbId===candidate.tmdbId&&item.mediaType===candidate.mediaType)){setResults([]);setMessage("这个作品已经在影视记录中。");return}
    addMedia(candidate);searchDraft.clearDraft();setResults([]);setMessage(`已加入「${candidate.title}」。`);setQuery("");
  }

  return <><ClassicPageScaffold
    lead={<PageLead title="影视" slogan="让看过的东西，也留下一点回声。" />}
    pinned={<Card className="media-search-card"><div className="card-header"><div><h2>搜索作品</h2><p>选择具体的电影或剧集后加入记录。</p></div></div><form className="media-search-form" onSubmit={search}><Input aria-label="影视搜索词" value={query} onChange={event=>handleQueryChange(event.target.value)} placeholder="电影或剧集名称"/><SelectMenu className={`media-type-choice type-${hint}`} ariaLabel="影视范围" value={hint} onChange={handleHintChange} options={[{value:"unknown",label:"电影或剧集"},{value:"movie",label:"电影"},{value:"tv",label:"剧集"}]}/><Button type="submit" disabled={searching||!query.trim()||!desktop}>{searching?"搜索中…":"搜索作品"}</Button></form>{!desktop&&<p className="provider-warning">请在桌面应用中配置 TMDB Token 后搜索。</p>}{message&&<p className="media-message" role="status">{message}</p>}{results.length>0&&<div className="media-search-results">{results.map(candidate=><button type="button" className="media-result" key={`${candidate.mediaType}-${candidate.tmdbId}`} onClick={()=>choose(candidate)}><span className="media-result-poster" aria-hidden>{candidate.posterPath?"▣":"□"}</span><span><strong>{candidate.title}</strong><small>{candidate.mediaType==="movie"?"电影":"剧集"}{candidate.releaseYear?` · ${candidate.releaseYear}`:""}{candidate.originalTitle&&candidate.originalTitle!==candidate.title?` · ${candidate.originalTitle}`:""}</small></span><span className="media-result-action">加入</span></button>)}</div>}</Card>}
    contentClassName="page media-page"
  >
    <section className="section"><div className="section-head"><div><h2>影视对象</h2><p className="media-subtitle">海报加载失败时保留色块，不影响记录和状态事件。</p></div><span className="tag">{data.mediaItems.length} 项</span></div>{data.mediaItems.length?<div className="media-grid">{data.mediaItems.map((item,index)=><MediaItemCard key={item.id} item={item} index={index} onDelete={()=>setPendingDelete({id:item.id,title:item.title})}/>)}</div>:<div className="empty"><strong>还没有影视记录。</strong><p>搜索一个具体的电影或剧集，再决定是否留下它。</p></div>}</section>
    <p className="media-attribution">影视资料与海报来自 TMDB。This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  </ClassicPageScaffold><ConfirmDialog open={Boolean(pendingDelete)} title={`删除《${pendingDelete?.title ?? ""}》？`} description="这条记录和相关历史事件会被删除，无法恢复。" confirmLabel="删除影视记录" onCancel={()=>setPendingDelete(undefined)} onConfirm={()=>{if(pendingDelete)removeMedia(pendingDelete.id);setPendingDelete(undefined)}}/></>;
}

function searchErrorText(error:unknown){
  const code=error instanceof Error?error.message:String(error);
  return ({CREDENTIAL_NOT_CONFIGURED:"尚未配置 TMDB Token，请先到设置中保存。",INVALID_API_KEY:"TMDB Token 无效，请到设置中更新。",UPSTREAM_RATE_LIMITED:"TMDB 请求过于频繁，请稍后重试。",UPSTREAM_UNAVAILABLE:"TMDB 暂时不可用，记录功能不受影响。",UPSTREAM_REQUEST_FAILED:"TMDB 请求失败，请稍后重试。",UPSTREAM_INVALID_RESPONSE:"TMDB 返回了无法识别的结果。",DESKTOP_RUNTIME_REQUIRED:"影视搜索需要在桌面应用中使用。"} as Record<string,string>)[code]??`搜索失败：${code}`;
}
