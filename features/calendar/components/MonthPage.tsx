"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatChineseDate, fromDateKey, toDateKey } from "@/lib/dates";
import { useOpenEnds } from "@/lib/storage/store";
import { buildMonthViewModel } from "@/ui/view-models/month-history";
import { MonthGrid } from "./MonthGrid";
import { PageLead } from "@/components/ui/PageLead";
import { ContextualTaskTitle } from "@/features/tasks/components/ContextualTaskTitle";
import { ClassicPageScaffold } from "@/ui/editions/classic/layout/ClassicPageScaffold";
import { EditionIcon } from "@/ui/themes/EditionIcon";
import { FocusIcon } from "@/components/ui/FocusIcon";

export function MonthPage() {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(toDateKey(now));
  const { data } = useOpenEnds();
  const viewModel = buildMonthViewModel(data, cursor.getFullYear(), cursor.getMonth(), selected);
  const { stats, historyByDate, selectedHistory, selectedDailyTasks, selectedFactCount } = viewModel;

  function move(n: number) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
    setCursor(d);
    setSelected(toDateKey(d));
  }

  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(toDateKey(now));
  }

  return (
    <ClassicPageScaffold
      lead={<PageLead className="month-page-lead" title="月览" slogan="把一个月摊开，看见行动留下的痕迹。" meta={<time dateTime={`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`}>{cursor.getFullYear()}年{cursor.getMonth() + 1}月</time>} actions={<div className="row page-actions">
          <Button variant="ghost" onClick={() => move(-1)} aria-label="上个月">←</Button>
          <Button variant="ghost" onClick={() => goToday()}>今天</Button>
          <Button variant="ghost" onClick={() => move(1)} aria-label="下个月">→</Button>
        </div>} />}
      contentClassName="page month-page"
    >

      <div className="grid stats month-stats">
        <div className="card stat-card"><div className="month-stat-icon"><EditionIcon slot="monthDone" /></div><strong>{stats.done}</strong><span>本月完成</span></div>
        <div className="card"><div className="month-stat-icon"><EditionIcon slot="monthOpen" /></div><strong>{stats.open}</strong><span>仍然未了</span></div>
        <div className="card"><div className="month-stat-icon"><EditionIcon slot="monthRescheduled" /></div><strong>{stats.rescheduled}</strong><span>重新安排</span></div>
      </div>

      <div className="month-layout">
        <article className="card calendar-card">
          <MonthGrid year={cursor.getFullYear()} month={cursor.getMonth()} tasks={data.tasks} events={data.taskEvents} focus={data.dailyFocus} historyByDate={historyByDate} selected={selected} onSelect={setSelected} />
          <div className="legend">
            <span><i className="amber" />原计划</span><span><i className="green" />完成</span><span><i className="rust" />延期出去</span><span><i className="red" />放弃</span><span><FocusIcon active />今日核心</span>
          </div>
        </article>

        <article className="card detail-card">
          <div className="detail-head">
            <div className="detail-date">{selected.slice(8, 10)}</div>
            <div className="detail-day">{formatChineseDate(fromDateKey(selected))}</div>
          </div>
          <div className="detail-section">
            <div className="detail-section-title"><h3>当天事实</h3><span className="detail-count">{selectedFactCount}</span></div>
            {selectedFactCount ? <div className="daily-history">{selectedHistory.focus && <div className="focus-fact"><span><FocusIcon active /> 今日核心</span><strong><ContextualTaskTitle title={selectedHistory.focus.title} /></strong></div>}<HistoryList label="当日任务" items={selectedDailyTasks} /><HistoryList label="当日完成" items={selectedHistory.completed.filter(item => item.id !== selectedHistory.focus?.id)} /></div> : <p className="muted">这一天还没有任务或完成记录。</p>}
          </div>
        </article>
      </div>
    </ClassicPageScaffold>
  );
}

function HistoryList({ label, items }: { label: string; items: Array<{ id: string; title: string }> }) {
  if (!items.length) return null;
  return <div className="history-fact-group"><h4>{label}</h4><ul className="day-task-list">{items.map(item => <li key={`${label}-${item.id}`}><strong><ContextualTaskTitle title={item.title} /></strong></li>)}</ul></div>;
}
