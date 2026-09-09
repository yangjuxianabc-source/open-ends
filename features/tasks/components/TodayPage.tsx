"use client";
import { useState } from "react";
import { formatChineseDate, toDateKey } from "@/lib/dates";
import { useOpenEnds } from "@/lib/storage/store";
import { TaskInput } from "./TaskInput";
import { TaskList } from "./TaskList";
import { buildTodayViewModel, type TodayTaskGroup } from "@/ui/view-models/today";
import { PageLead } from "@/components/ui/PageLead";
import { ClassicPageScaffold } from "@/ui/editions/classic/layout/ClassicPageScaffold";

export function TodayPage() {
  const today = toDateKey(new Date());
  const { data, transitionTask, setDailyFocus } = useOpenEnds();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const viewModel = buildTodayViewModel(data, today);
  const goal = viewModel.focus;
  const goalDone = viewModel.focusCompleted;

  return <ClassicPageScaffold
    lead={<PageLead title="今日" slogan="把今天留给真正重要的事。" meta={<time dateTime={today}>{formatChineseDate(new Date())}</time>} />}
    contentClassName="page today-page"
  >
    <article className={`card today-focus-card ${goal ? "" : "is-empty"}`.trim()}>
      <section className="focus-card">
        <div className="card-header focus-card-header"><div className="today-section-heading"><span>FOCUS</span><h2>今日核心</h2></div></div><div className="orbit" aria-hidden="true"><div className="sun" /></div>
        {goal ? <div className={`focus-task ${goalDone ? "is-done" : ""}`}>
          <button className={`check ${goalDone ? "done" : ""}`} aria-label={goalDone ? "恢复任务" : "完成最重要的这件事"} onClick={() => transitionTask(goal.id, goalDone ? "open" : "done")}><svg viewBox="0 0 24 24" aria-hidden><path d="m6 12.5 4 4L18 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          <div><h3 className={goalDone ? "done" : ""}>{goal.title}</h3></div>
          <button className="focus-clear" onClick={() => setDailyFocus(today)} aria-label="取消今日唯一重要之事" title="取消今日唯一重要之事">✕</button>
        </div> : <div className="focus-empty-state"><div className="focus-empty-divider" aria-hidden="true"><span /></div><strong>每一天，都有一件值得优先完成的事。</strong><span>选定你的今日核心，专注投入</span></div>}
      </section>
    </article>
    <article className="card task-list-card"><div className="card-header"><div className="today-section-heading"><span>OTHER TASKS</span><h2>其他任务</h2></div><span className="tag">{viewModel.otherTasks.length} 项</span></div><TaskInput date={today} /><TodayTaskGroups groups={viewModel.otherTaskGroups} editingKey={editingKey} onEditingKeyChange={setEditingKey} onFocus={taskId => setDailyFocus(today, taskId)} /></article>
  </ClassicPageScaffold>;
}

function TodayTaskGroups({ groups, editingKey, onEditingKeyChange, onFocus }: { groups: TodayTaskGroup[]; editingKey: string | null; onEditingKeyChange: (key: string | null) => void; onFocus: (taskId: string) => void }) {
  if (!groups.length) return <TaskList tasks={[]} showDomain={false} listId="today" editingKey={editingKey} onEditingKeyChange={onEditingKeyChange} empty="还没有其他任务。想到的任务先记录下来，稍后再安排。" onFocus={onFocus} />;
  return <div className="today-task-groups">{groups.map(group => <div className="today-task-group" key={group.key} aria-label={group.sourceSparkId ? "来自同一闪念的任务" : "单项任务"}><TaskList tasks={group.tasks} showDomain={false} listId={`today-${group.key}`} editingKey={editingKey} onEditingKeyChange={onEditingKeyChange} onFocus={onFocus} /></div>)}</div>;
}
