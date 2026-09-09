"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InsightDocument } from "@/features/ai-insights/components/InsightDocument";
import { addDays, toDateKey } from "@/lib/dates";
import { generateReviewMarkdown, reviewReportFileName } from "@/lib/export/reviewReport";
import { useOpenEnds } from "@/lib/storage/store";
import type { TaskDomain } from "@/types";
import { reviewTypeLabel } from "../services/generation";
import { buildReviewGenerationInput, reviewInputHash } from "../services/comparison";
import { buildPeriodDescriptor, buildProfileViewModel, buildReviewViewModel, type ProfileViewModel, type ReviewPeriod, type ReviewView, type ReviewViewModel } from "@/ui/view-models/review";
import { PageLead } from "@/components/ui/PageLead";
import { ContextualTaskTitle } from "@/features/tasks/components/ContextualTaskTitle";
import { ClassicPageScaffold } from "@/ui/editions/classic/layout/ClassicPageScaffold";
import { changeReviewPeriod, changeReviewView, initialReviewNavigationState } from "./review-state";

const periods: Array<{ key: ReviewPeriod; label: string }> = [
  { key: "weekly", label: "周" },
  { key: "monthly", label: "月" },
  { key: "yearly", label: "年" },
];
const labels: Record<TaskDomain, string> = {
  work: "工作",
  study: "学习",
  creation: "创作",
  project: "项目",
  life: "生活",
  health: "健康",
  relationship: "关系",
  reading: "阅读",
  leisure: "娱乐",
  other: "其他",
};

export function ReviewPage() {
  const { data, ready, storageKind, generatePeriodReview, generateProfileSnapshot } = useOpenEnds();
  const [navigation, setNavigation] = useState(initialReviewNavigationState);
  const { period, view } = navigation;
  const [anchor, setAnchor] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [currentReviewInput, setCurrentReviewInput] = useState<{ snapshotId: string; hash: string }>();
  const today = toDateKey(new Date());
  const profileViewModel = useMemo(() => buildProfileViewModel(data, today), [data, today]);
  const descriptor = buildPeriodDescriptor(period, anchor);
  const currentDescriptor = buildPeriodDescriptor(period, new Date());
  const basePeriodViewModel = buildReviewViewModel(data, descriptor, currentDescriptor);
  const periodViewModel = buildReviewViewModel(
    data,
    descriptor,
    currentDescriptor,
    currentReviewInput && currentReviewInput.snapshotId === basePeriodViewModel.snapshot?.id ? currentReviewInput.hash : undefined,
  );

  useEffect(() => {
    let active = true;
    if (!basePeriodViewModel.snapshot) return () => { active = false; };
    const input = buildReviewGenerationInput(data, basePeriodViewModel.snapshot);
    void reviewInputHash(input).then(hash => {
      if (active) setCurrentReviewInput({ snapshotId: basePeriodViewModel.snapshot!.id, hash });
    });
    return () => { active = false; };
  }, [basePeriodViewModel.snapshot, data]);

  function movePeriod(delta: number) {
    setAnchor(current => {
      if (delta === 0) return new Date();
      if (descriptor.type === "weekly") return addDays(current, delta * 7);
      if (descriptor.type === "monthly") return new Date(current.getFullYear(), current.getMonth() + delta, 1);
      return new Date(current.getFullYear() + delta, current.getMonth(), 1);
    });
  }

  function selectPeriod(next: ReviewPeriod) {
    setMessage("");
    setNavigation(current => changeReviewPeriod(current, next));
    setAnchor(new Date());
  }

  function selectView(next: ReviewView) {
    setMessage("");
    setNavigation(current => changeReviewView(current, next));
  }

  async function generate() {
    setBusy(true);
    setMessage("正在准备本期事实…");
    try {
      setMessage("事实已准备，正在生成生活回顾…");
      const result = await generatePeriodReview({ periodType: descriptor.type, periodKey: descriptor.key, periodStart: descriptor.start, periodEnd: descriptor.end });
      setMessage(result.ok ? "已生成" : errorText(result.error));
    } catch (error) {
      setMessage(errorText(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  async function generateProfileNow() {
    setBusy(true);
    setMessage("正在根据最新记录生成生活画像…");
    try {
      const result = await generateProfileSnapshot();
      setMessage(result.ok ? "画像已更新" : errorText(result.error));
    } catch (error) {
      setMessage(errorText(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!periodViewModel.snapshot) return;
    const text = generateReviewMarkdown(periodViewModel.snapshot, periodViewModel.stale ? undefined : periodViewModel.review ?? undefined);
    downloadText(reviewReportFileName(periodViewModel.snapshot), text, "text/markdown;charset=utf-8");
  }

  return (
    <ClassicPageScaffold
      lead={<PageLead title="回顾" slogan="让生活留下可回看的形状。" />}
      pinned={<ReviewContext
       period={period}
         viewModel={periodViewModel}
        onPeriodChange={selectPeriod}
        onViewChange={selectView}
        onMove={movePeriod}
      />}
      contentClassName="page review-page"
    >
      {view === "profile"
        ? <ProfilePanel ready={ready} storageKind={storageKind} viewModel={profileViewModel} busy={busy} message={message} onGenerate={generateProfileNow} onBack={() => selectView("facts")} />
        : view === "summary"
          ? <SummaryPanel ready={ready} storageKind={storageKind} viewModel={periodViewModel} busy={busy} message={message} onGenerate={generate} onDownload={download} onBack={() => selectView("facts")} />
          : <PeriodFacts viewModel={periodViewModel} />}
    </ClassicPageScaffold>
  );
}

function ReviewContext({ period, viewModel, onPeriodChange, onViewChange, onMove }: {
  period: ReviewPeriod;
  viewModel: ReviewViewModel;
  onPeriodChange: (period: ReviewPeriod) => void;
  onViewChange: (view: ReviewView) => void;
  onMove: (delta: number) => void;
}) {
  const { descriptor, review, stale, isCurrent, canNext } = viewModel;
  const summaryLabel = review && !stale ? "查看总结" : stale ? "更新总结" : "生成总结";
  return <div className="review-context-rail">
    <div className="review-period-tabs" role="tablist" aria-label="回顾周期">
      {periods.map(item => <button key={item.key} type="button" role="tab" aria-selected={period === item.key} className={period === item.key ? "active" : ""} onClick={() => onPeriodChange(item.key)}>{item.label}</button>)}
    </div>
    <div className="review-context-main">
      <div className="review-context-copy"><span className="tiny-label">期间</span><strong>{descriptor.start} — {descriptor.end}</strong></div>
      <div className="week-nav"><Button variant="ghost" onClick={() => onMove(-1)} aria-label="上一期">← 上一期</Button><Button variant="ghost" onClick={() => onMove(0)} disabled={isCurrent}>本期</Button><Button variant="ghost" onClick={() => onMove(1)} disabled={!canNext} aria-label="下一期">下一期 →</Button></div>
    </div>
    <div className="review-context-actions">
      <Button variant="secondary" onClick={() => onViewChange("summary")}>{summaryLabel}</Button>
      <Button variant="secondary" onClick={() => onViewChange("profile")}>生活画像</Button>
    </div>
  </div>;
}

function PeriodFacts({ viewModel }: { viewModel: ReviewViewModel }) {
  const { descriptor, snapshot, stats, domains, recordFacts, transitionFacts } = viewModel;
  const [recordScopePreference, setRecordScopePreference] = useState<"reading" | "media">(() => preferredRecordScope(recordFacts));
  const hasReading = recordFacts.some(fact => fact.scope === "reading");
  const hasMedia = recordFacts.some(fact => fact.scope === "media");
  const recordScope = recordFacts.some(fact => fact.scope === recordScopePreference) ? recordScopePreference : preferredRecordScope(recordFacts);
  const maxDomain = Math.max(1, ...domains.map(([, value]) => value));
  const visibleRecords = recordFacts.filter(fact => fact.scope === recordScope);
  return <div className="review-facts-view">
    <article className="card life-slice-card facts-primary-card">
      <div className="card-header"><div><span className="tiny-label">{reviewTypeLabel(descriptor.type)} facts</span><h2>{descriptor.title}</h2><p>事实来自真实行动，不是成绩单。</p></div>{snapshot ? <span className="tag">更新于 {new Date(snapshot.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span> : <span className="tag">待记录</span>}</div>
      <div className="slice-metrics"><div><strong>{stats.done}</strong><span>完成</span></div><div><strong>{stats.rescheduled}</strong><span>延期</span></div><div><strong>{stats.dropped}</strong><span>放下</span></div><div className="focus-metric"><strong>{stats.focus.completed}<small> / {stats.focus.assigned}</small></strong><span>Focus 完成</span></div></div>
      <div className="slice-domains">{domains.length ? domains.map(([key, value]) => <div className="bar-row" key={key}><span>{labels[key as TaskDomain]}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.round(value / maxDomain * 100)}%` }} /></div><strong>{value}</strong></div>) : <p className="muted">这个周期还没有任务事实。</p>}</div>
    </article>

    <div className="review-facts-layout">
      <article className="card review-facts-card"><div className="card-header"><div><span className="tiny-label">Open & turn</span><h2>未了与转向</h2><p>只展示最多五条具有代表性的变化。</p></div></div><TransitionFacts facts={transitionFacts} /></article>
      <article className="card review-facts-card"><div className="card-header"><div><span className="tiny-label">Reading & media</span><h2>阅读与影视</h2><p>只在这段时间确实发生过时出现。</p></div></div><div className="review-record-tabs" role="tablist" aria-label="阅读与影视记录"><button type="button" role="tab" aria-selected={recordScope === "reading"} className={recordScope === "reading" ? "active" : ""} disabled={!hasReading} onClick={() => setRecordScopePreference("reading")}>阅读</button><button type="button" role="tab" aria-selected={recordScope === "media"} className={recordScope === "media" ? "active" : ""} disabled={!hasMedia} onClick={() => setRecordScopePreference("media")}>影视</button></div>{visibleRecords.length ? <ul className="review-fact-list">{visibleRecords.map((fact, index) => <li key={`${fact.scope}-${fact.kind}-${fact.title}-${index}`}><span>{fact.kind}</span><strong>{fact.title}</strong><small>{fact.date}</small></li>)}</ul> : <p className="muted review-empty">这段时间还没有阅读或影视记录。</p>}</article>
    </div>
  </div>;
}

function SummaryPanel({ ready, storageKind, viewModel, busy, message, onGenerate, onDownload, onBack }: {
  ready: boolean;
  storageKind: "sqlite" | "browser-preview" | undefined;
  viewModel: ReviewViewModel;
  busy: boolean;
  message: string;
  onGenerate: () => void;
  onDownload: () => void;
  onBack: () => void;
}) {
  const { descriptor, snapshot, review, stale } = viewModel;
  return <article className="card review-reading-surface summary-surface">
    <div className="review-surface-back"><Button type="button" variant="ghost" onClick={onBack}>← 返回本期事实</Button></div>
    <div className="review-surface-heading"><div><span className="tiny-label">{reviewTypeLabel(descriptor.type)} summary</span><h2>{reviewTypeLabel(descriptor.type)}总结</h2><p>{descriptor.start} — {descriptor.end}</p></div>{review && <span className="tag">第 {review.revision} 版 · {new Date(review.generatedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>}</div>
    {stale && <p className="provider-warning">记录已经变化，这份总结需要更新。</p>}
    {review && !stale ? <InsightDocument content={review.content} /> : <div className="review-surface-empty"><strong>{snapshot ? "这一期还没有总结。" : "这一期还没有事实快照。"}</strong><p>{snapshot ? "准备好后，可以生成一份只读的生活回顾。" : "生成总结时会先准备本期事实。"}</p></div>}
    <div className="ai-actions"><Button onClick={onGenerate} disabled={!ready || storageKind !== "sqlite" || busy}>{busy ? "正在生成…" : review && !stale ? "重新生成" : stale ? "更新总结" : "生成总结"}</Button><Button variant="secondary" onClick={onDownload} disabled={!snapshot}>导出 Markdown</Button></div>
    {storageKind === "browser-preview" && <p className="provider-warning">请在桌面应用中生成。</p>}
    {message && <p className="review-operation-status" role="status">{message}</p>}
  </article>;
}

function TransitionFacts({ facts }: { facts: ReviewViewModel["transitionFacts"] }) {
  return facts.length ? <ul className="review-fact-list">{facts.map((fact, index) => <li key={`${fact.kind}-${fact.title}-${index}`}><span>{fact.kind}</span><strong><ContextualTaskTitle title={fact.title} /></strong><small>{fact.note}</small></li>)}</ul> : <p className="muted review-empty">这个周期没有需要特别标记的延续或转向。</p>;
}

function ProfilePanel({ ready, storageKind, viewModel, busy, message, onGenerate, onBack }: {
  ready: boolean;
  storageKind: "sqlite" | "browser-preview" | undefined;
  viewModel: ProfileViewModel;
  busy: boolean;
  message: string;
  onGenerate: () => void;
  onBack: () => void;
}) {
  const { profile, pack } = viewModel;
  const [showEvidence, setShowEvidence] = useState(false);
  const window90 = pack.windows.last90Days;
  return <article className="card review-reading-surface profile-surface">
    <div className="review-surface-back"><Button type="button" variant="ghost" onClick={onBack}>← 返回本期事实</Button></div>
    <div className="review-surface-heading"><div><span className="tiny-label">Living Profile</span><h2>生活画像</h2><p>证据截止 {pack.evidenceEnd}，描述一段时间里反复出现的生活线索。</p></div>{profile && <span className="tag">Revision {profile.revision} · 截至 {profile.evidenceEnd}</span>}</div>
    {profile ? <InsightDocument content={profile.content} /> : <div className="review-surface-empty"><strong>还没有生活画像。</strong><p>先从真实行动记录里，慢慢看见反复出现的线索。</p></div>}
    <div className="ai-actions"><Button onClick={onGenerate} disabled={!ready || storageKind !== "sqlite" || busy}>{busy ? "正在生成…" : profile ? "更新画像" : "生成画像"}</Button><Button type="button" variant="secondary" onClick={() => setShowEvidence(value => !value)}>{showEvidence ? "收起 Evidence" : "查看 Evidence"}</Button></div>
    {showEvidence && <div className="evidence-card"><div className="card-header"><div><span className="tiny-label">Evidence</span><h3>这份画像看见的事实</h3></div></div><div className="evidence-grid"><span>近 90 天完成</span><strong>{window90.tasks.completed}</strong><span>近 90 天重新安排</span><strong>{window90.tasks.rescheduled}</strong><span>近 90 天 Focus</span><strong>{window90.tasks.focusCompleted} / {window90.tasks.focusAssigned}</strong><span>阅读完成 / 影视完成</span><strong>{window90.reading.finished} / {window90.media.finished}</strong></div>{pack.openTaskAge.length > 0 && <div className="evidence-list"><p>仍在等待的事项</p><ul>{pack.openTaskAge.slice(0, 5).map(item => <li key={`${item.title}-${item.ageDays}`}>{item.title} · {item.ageDays} 天</li>)}</ul></div>}</div>}
    {storageKind === "browser-preview" && <p className="provider-warning">请在桌面应用中生成。</p>}
    {message && <p className="review-operation-status" role="status">{message}</p>}
  </article>;
}

function preferredRecordScope(facts: ReviewViewModel["recordFacts"]): "reading" | "media" {
  return facts.some(fact => fact.scope === "reading") ? "reading" : "media";
}

function downloadText(name: string, text: string, type: string) {
  const blob = new Blob(["\ufeff" + text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function errorText(error: string) {
  return ({
    DESKTOP_RUNTIME_REQUIRED: "请在 Open Ends 桌面应用中生成 AI 内容。",
    CREDENTIAL_NOT_CONFIGURED: "请先在设置中配置 DeepSeek API Key。",
    UPSTREAM_INVALID_RESPONSE: "AI 返回格式无法识别，原有数据未改变。",
    AI_INVALID_JSON_CONTENT: "AI 返回了非严格 JSON，未写入数据库。",
    AI_INVALID_CONTENT_SCHEMA: "AI 返回缺少 content 字段，未写入数据库。",
    AI_EMPTY_CONTENT: "AI 返回了空内容，未写入数据库。",
    AI_UNSTRUCTURED_CONTENT: "AI 返回没有按栏目组织，未写入数据库，请重新生成。",
    STORAGE_WRITE_FAILED: "内容生成了，但保存到本地失败，请稍后重试。",
  } as Record<string, string>)[error] ?? `生成失败：${error}`;
}
