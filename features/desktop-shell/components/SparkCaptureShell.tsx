"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/Button";
import {hideCurrentWindow,isDesktopRuntime} from "@/lib/desktop/tauri-client";
import {useOpenEnds} from "@/lib/storage/store";
import {createDraftRestoreGuard,draftKeys,useDraftAutosave} from "@/lib/drafts/draft-cache";

export function SparkCaptureShell(){
  const [content,setContent]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const router=useRouter();const {addSpark,analyzeSpark}=useOpenEnds();
  const contentDraft=useDraftAutosave(draftKeys.sparkCapture,content);
  const restoreGuardRef=useRef(createDraftRestoreGuard());
  const contentRef=useRef(content);
  useEffect(()=>{contentRef.current=content},[content]);
  useEffect(()=>{
    const restored=contentDraft.restoredValue;
    if(restored===null||!restoreGuardRef.current.consume(restored,contentRef.current===""))return;
    contentRef.current=restored;setContent(restored);setMessage("已恢复未保存内容");
  },[contentDraft.restoredValue]);
  const close=useCallback(()=>{if(isDesktopRuntime())void hideCurrentWindow();else router.push("/spark")},[router]);
  useEffect(()=>{const handleKeyDown=(event:KeyboardEvent)=>{if(event.key!=="Escape")return;event.preventDefault();close()};window.addEventListener("keydown",handleKeyDown);return()=>window.removeEventListener("keydown",handleKeyDown)},[close]);
  async function save(organize:boolean){const value=content.trim();if(!value)return;setBusy(true);try{const sparkId=await addSpark(value);contentDraft.clearDraft();setContent("");if(organize)void analyzeSpark(sparkId);setMessage(organize?"已保存，正在整理":"已保存");window.setTimeout(()=>setMessage(""),1200);if(isDesktopRuntime())window.setTimeout(close,700)}catch{setMessage("保存失败，内容仍在输入框中")}finally{setBusy(false)}}
  function handleContentChange(nextValue:string){
    restoreGuardRef.current.markUserEdited();contentRef.current=nextValue;setContent(nextValue);
    if(nextValue.trim()==="")contentDraft.clearDraft();
    setMessage(value=>value==="已恢复未保存内容"?"":value);
  }
  return <main className="desktop-mini spark-capture-shell"><div className="spark-capture-intro"><div><strong>闪念</strong><span>先接住，再决定要不要整理。</span></div></div><textarea autoFocus className="spark-input" aria-label="闪念内容" value={content} onChange={event=>handleContentChange(event.target.value)} placeholder="写下这一刻想到的事……"/>{message&&<p className="spark-capture-message" role="status">{message}</p>}<div className="capture-actions"><Button disabled={!content.trim()||busy} onClick={()=>void save(false)}>保存</Button><Button variant="secondary" disabled={!content.trim()||busy} onClick={()=>void save(true)}>保存并整理</Button></div></main>
}
