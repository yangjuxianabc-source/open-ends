/* eslint-disable @next/next/no-img-element -- remote candidate covers have a local color fallback */
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createDraftRestoreGuard, draftKeys, useDraftAutosave } from "@/lib/drafts/draft-cache";
import { useOpenEnds } from "@/lib/storage/store";
import type { ReadingItem, ReadingType } from "@/types";
import { searchReadingCandidates, type ReadingCandidate } from "../services/candidates";
import { ReadingItemCard } from "./ReadingItemCard";
import { PageLead } from "@/components/ui/PageLead";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { ClassicPageScaffold } from "@/ui/editions/classic/layout/ClassicPageScaffold";

type CandidateTarget =
  | { mode: "add"; title: string; author?: string }
  | { mode: "replace"; itemId: string; title: string; author?: string };

export function ReadingPage() {
  const { data, ready, storageKind, addReading, updateReading, removeReading: deleteReading } = useOpenEnds();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [type, setType] = useState<ReadingType>("book");
  const [searching, setSearching] = useState(false);
  const [candidateTarget, setCandidateTarget] = useState<CandidateTarget>();
  const [candidates, setCandidates] = useState<ReadingCandidate[]>([]);
  const [candidateMessage, setCandidateMessage] = useState("");
  const [readingMessage, setReadingMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string }>();
  const formDraft = useDraftAutosave(draftKeys.readingNew, { title, author, type }, { shouldSave: value => Boolean(value.title.trim() || value.author.trim()) });
  const formRestoreGuardRef = useRef(createDraftRestoreGuard());
  const titleRef = useRef(title);
  const authorRef = useRef(author);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { authorRef.current = author; }, [author]);

  useEffect(() => {
    const restored = formDraft.restoredValue;
    if (restored === null || !formRestoreGuardRef.current.consume(restored, titleRef.current === "" && authorRef.current === "")) return;
    titleRef.current = restored.title ?? "";
    authorRef.current = restored.author ?? "";
    setTitle(titleRef.current);
    setAuthor(authorRef.current);
    setType(restored.type ?? "book");
    setReadingMessage("已恢复未保存内容");
  }, [formDraft.restoredValue]);

  function handleTitleChange(nextValue: string) {
    formRestoreGuardRef.current.markUserEdited();
    titleRef.current = nextValue;
    setTitle(nextValue);
    if (nextValue.trim() === "" && authorRef.current.trim() === "") formDraft.clearDraft();
    setReadingMessage(value => value === "已恢复未保存内容" ? "" : value);
  }

  function handleAuthorChange(nextValue: string) {
    formRestoreGuardRef.current.markUserEdited();
    authorRef.current = nextValue;
    setAuthor(nextValue);
    if (titleRef.current.trim() === "" && nextValue.trim() === "") formDraft.clearDraft();
    setReadingMessage(value => value === "已恢复未保存内容" ? "" : value);
  }

  function handleTypeChange(nextValue: string) {
    formRestoreGuardRef.current.markUserEdited();
    setType(nextValue as ReadingType);
    cancelCandidateSearch();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const nextAuthor = author.trim() || undefined;
    if (type === "book" && storageKind === "sqlite") {
      await searchCandidates({ mode: "add", title: nextTitle, author: nextAuthor });
      return;
    }
    addReading(nextTitle, nextAuthor ?? "", type);
    formDraft.clearDraft();
    clearForm();
    setReadingMessage("已保存");
  }

  async function searchCandidates(target: CandidateTarget) {
    setCandidateTarget(target);
    setCandidates([]);
    setCandidateMessage("");
    if (storageKind !== "sqlite") {
      setCandidateMessage("浏览器开发预览不连接书籍数据源，可直接保存本地记录。请在桌面版中搜索候选。");
      return;
    }
    setSearching(true);
    try {
      const next = await searchReadingCandidates(target.title, target.author);
      setCandidates(next);
      if (!next.length) setCandidateMessage("暂未找到匹配书籍，可先保留本地记录。");
    } catch {
      if (target.mode === "add") {
        saveLocalBook(target, "书籍数据源暂时不可用，已保存本地记录。");
      } else {
        setCandidateMessage("书籍数据源暂时不可用，当前记录未修改。");
      }
    } finally {
      setSearching(false);
    }
  }

  function openReplacement(item: ReadingItem) {
    document.getElementById("reading-form")?.scrollIntoView({ behavior: "smooth" });
    void searchCandidates({ mode: "replace", itemId: item.id, title: item.title, author: item.author });
  }

  function cancelCandidateSearch() {
    setCandidateTarget(undefined);
    setCandidates([]);
    setCandidateMessage("");
  }

  function clearForm() {
    setTitle("");
    setAuthor("");
    setType("book");
    cancelCandidateSearch();
  }

  function saveWithoutCandidate() {
    if (!candidateTarget || candidateTarget.mode !== "add") return;
    saveLocalBook(candidateTarget, "暂未找到匹配书籍，已先保留本地记录。");
  }

  function saveLocalBook(target: Extract<CandidateTarget, { mode: "add" }>, message: string) {
    addReading(target.title, target.author ?? "", "book");
    formDraft.clearDraft();
    clearForm();
    setReadingMessage(message);
  }

  function saveSelectedCandidate(candidate: ReadingCandidate) {
    if (!candidateTarget) return;
    const selectedAuthor = candidate.authors.filter(Boolean).join("、") || candidateTarget.author;
    const cover = candidate.url
      ? { provider: candidate.provider, externalId: candidate.externalId, url: candidate.url, matchedAt: new Date().toISOString() }
      : undefined;
    if (candidateTarget.mode === "add") {
      const itemId = addReading(candidate.title, selectedAuthor ?? "", "book");
      if (cover) updateReading(itemId, { cover });
      formDraft.clearDraft();
      clearForm();
      setReadingMessage(cover ? "已选择并保存书籍与封面。" : "已选择并保存书籍；该候选没有封面，已保留色块。");
      return;
    }
    updateReading(candidateTarget.itemId, { title: candidate.title, author: selectedAuthor, cover });
    cancelCandidateSearch();
    setReadingMessage(cover ? "已更换书籍与封面。" : "已更换书籍；该候选没有封面，已保留色块。");
  }

  function handleDelete(itemId: string, itemTitle: string) {
    setPendingDelete({ id: itemId, title: itemTitle });
  }

  const canSubmit = ready && !searching && Boolean(title.trim());

  return <><ClassicPageScaffold
    lead={<PageLead title="阅读" slogan="让读过的东西，留下一点回声。" />}
    pinned={<article className="card reading-form-card" id="reading-form">
      <div className="card-header"><div><h2>加入阅读</h2><p>书籍可以先匹配版本，文章和论文直接保存。</p></div></div>
      <form className="reading-form" onSubmit={submit}>
        <Input aria-label="阅读对象标题" value={title} onChange={event => handleTitleChange(event.target.value)} placeholder="书、文章或论文名称" />
        <Input aria-label="作者" value={author} onChange={event => handleAuthorChange(event.target.value)} placeholder="作者（可选）" />
        <SelectMenu className={`reading-type-choice type-${type}`} ariaLabel="阅读类型" value={type} onChange={handleTypeChange} options={[{value:"book",label:"书"},{value:"article",label:"文章"},{value:"paper",label:"论文"},{value:"other",label:"其他"}]}/>
        <Button type="submit" disabled={!canSubmit}>{searching ? "搜索中…" : type === "book" && storageKind === "sqlite" ? "搜索书籍" : "保存"}</Button>
      </form>
      {type === "book" && storageKind !== "sqlite" && <p className="provider-warning reading-provider-note">浏览器开发预览不调用书籍数据源，但仍可保存本地阅读记录。</p>}

      {candidateTarget && !searching && <CandidatePanel
        target={candidateTarget}
        candidates={candidates}
        message={candidateMessage}
        onSelect={saveSelectedCandidate}
        onSaveLocal={saveWithoutCandidate}
        onCancel={cancelCandidateSearch}
      />}
    </article>}
    contentClassName="page reading-page"
  >

    <section className="section">
      <div className="reading-toolbar">
        <div className="section-head" style={{ marginBottom: 0 }}><div><h2>阅读对象</h2><p className="reading-subtitle">不追踪页码，只看看它们此刻处在什么位置。</p></div></div>
      </div>
      {readingMessage && <p className="cover-message">{readingMessage}</p>}
      <div className="reading-grid">
        {data.readingItems.map((item, index) => <ReadingItemCard key={item.id} item={item} index={index} onReplace={() => openReplacement(item)} onDelete={() => handleDelete(item.id, item.title)} />)}
      </div>
      {!data.readingItems.length && <span className="muted">先放一本正在读的书，或一篇想读的文章。</span>}
    </section>
  </ClassicPageScaffold><ConfirmDialog open={Boolean(pendingDelete)} title={`删除《${pendingDelete?.title ?? ""}》？`} description="这条记录和相关历史事件会被删除，无法恢复。" confirmLabel="删除阅读记录" onCancel={() => setPendingDelete(undefined)} onConfirm={() => { if (pendingDelete) deleteReading(pendingDelete.id); setPendingDelete(undefined); }} /></>;
}

function CandidatePanel({ target, candidates, message, onSelect, onSaveLocal, onCancel }: {
  target: CandidateTarget;
  candidates: ReadingCandidate[];
  message: string;
  onSelect: (candidate: ReadingCandidate) => void;
  onSaveLocal: () => void;
  onCancel: () => void;
}) {
  return <div className="reading-candidate-panel" aria-live="polite">
    <div className="candidate-panel-head">
      <div><h3>{target.mode === "add" ? "选择匹配书籍" : "更换当前书籍"}</h3><p>搜索：{target.title}{target.author ? ` · ${target.author}` : ""}</p></div>
      <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
    </div>
    {message && <p className="candidate-status">{message}</p>}
    {candidates.length > 0 && <p className="candidate-status">找到 {candidates.length} 本匹配书籍，推荐结果排在最前。</p>}
    {candidates.length > 0 && <div className="reading-candidate-list">
      {candidates.map((candidate,index) => {
        return <article className="reading-candidate" key={`${candidate.provider}-${candidate.externalId}`}>
          <div className="candidate-cover-frame">
            {candidate.url ? <img className="candidate-cover" src={candidate.url} alt={`《${candidate.title}》候选封面`} loading="lazy" referrerPolicy="no-referrer" /> : <div className="candidate-cover candidate-cover-empty"><span>无封面</span></div>}
          </div>
          <div className="candidate-copy"><div className="candidate-title-row"><h4>{candidate.title}</h4>{index === 0 && <span className="candidate-recommended">推荐</span>}</div><p>{candidate.authors.length ? candidate.authors.join("、") : "作者未知"}</p><p className="candidate-details">{[candidate.publisher, candidate.publishedDate].filter(Boolean).join(" · ") || "出版信息未知"}</p>{(candidate.isbn13 || candidate.isbn10) && <p className="candidate-isbn">ISBN {candidate.isbn13 || candidate.isbn10}</p>}<Button type="button" variant={index === 0 ? "primary" : "secondary"} onClick={() => onSelect(candidate)}>{index === 0 ? "使用此版本" : "选择"}</Button></div>
        </article>;
      })}
    </div>}
    {!candidates.length && target.mode === "add" && <div className="candidate-fallback"><Button type="button" variant="secondary" onClick={onSaveLocal}>直接保存本地记录</Button></div>}
  </div>;
}
