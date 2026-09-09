"use client";
import { useState } from "react";
import { addDays, fromDateKey, toDateKey } from "@/lib/dates";
import { useOpenEnds } from "@/lib/storage/store";
import { TaskList } from "@/features/tasks/components/TaskList";
import { buildOpenThreadsViewModel } from "@/ui/view-models/open-threads";
import { OpenItemGroup } from "./OpenItemGroup";
import { PageLead } from "@/components/ui/PageLead";
import { ClassicPageScaffold } from "@/ui/editions/classic/layout/ClassicPageScaffold";

export function OpenPage() {
  const { data, setDailyFocus } = useOpenEnds();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const today = toDateKey(new Date());
  const viewModel = buildOpenThreadsViewModel(data, today);
  const specs = [
    ["今天", viewModel.today.map(item => item.task)],
    ["此前", viewModel.before.map(item => item.task)],
    ["某天", viewModel.after.map(item => item.task)],
  ] as const;
  const openCount = viewModel.today.length + viewModel.before.length + viewModel.after.length;
  const todayFocusTaskId = data.dailyFocus.find(item => item.date === today)?.taskId;
  return (
    <ClassicPageScaffold
      lead={<PageLead title="未了" slogan="未了，也是一种生活信息。" />}
      contentClassName="page open-page"
    >
      <section className="card open-continuous">
        <div className="open-total"><span className="open-total-copy"><span className="tiny-label">Open Threads</span><strong>未了总数</strong></span><span className="count-pill">{openCount}</span></div>
        {openCount ? specs.filter(([, tasks]) => tasks.length).map(([title, tasks]) => <OpenItemGroup key={title} title={title} tasks={tasks} getSecondaryText={task => openDateLabel(task.plannedDate, today)} listId={`open-${title}`} editingKey={editingKey} onEditingKeyChange={setEditingKey} focusTaskId={title === "今天" ? todayFocusTaskId : undefined} focusTaskIds={title !== "今天" ? tasks.filter(task => viewModel.focusDatesByTask[task.id]?.length).map(task => task.id) : undefined} focusDatesByTask={title !== "今天" ? viewModel.focusDatesByTask : undefined} onFocus={title === "今天" ? taskId => setDailyFocus(today, taskId === todayFocusTaskId ? undefined : taskId) : undefined} reserveFocusColumn={title !== "今天"} />) : <p className="open-empty">此刻没有悬着的事。</p>}
      </section>
      <details className="card dropped-region"><summary><span><span className="tiny-label">Released</span><strong>放弃</strong></span><span className="count-pill">{viewModel.dropped.length}</span></summary><div className="dropped-list"><p>不再继续，也是一种清楚的选择。需要时可以恢复为未了。</p><TaskList tasks={viewModel.dropped.map(item => item.task)} showDomain={false} showRescheduleCount getSecondaryText={task => openDateLabel(task.plannedDate, today)} focusDatesByTask={viewModel.focusDatesByTask} reserveFocusColumn listId="open-dropped" editingKey={editingKey} onEditingKeyChange={setEditingKey} /></div></details>
    </ClassicPageScaffold>
  );
}

function openDateLabel(date:string|undefined,today:string){
  if(!date)return "某天";
  if(date===today)return "今天";
  if(date===toDateKey(addDays(fromDateKey(today),1)))return "明天";
  const [year,month,day]=date.split("-").map(Number);
  return year===Number(today.slice(0,4))?`${month}月${day}日`:`${year}年${month}月${day}日`;
}
