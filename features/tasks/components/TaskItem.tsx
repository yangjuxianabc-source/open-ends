"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { deferDates, useOpenEnds } from "@/lib/storage/store";
import { rescheduleCount } from "@/features/tasks/services/history";
import type { Task, TaskDomain } from "@/types";
import { taskDomainLabels, taskDomainOptions } from "./taskDomains";
import {SelectMenu} from "@/components/ui/SelectMenu";
import {ContextualTaskTitle} from "./ContextualTaskTitle";
import {FocusIcon} from "@/components/ui/FocusIcon";

interface TaskItemProps {
  task: Task;
  onFocus?: (id: string) => void;
  isFocus?: boolean;
  focusDates?: readonly string[];
  showDomain?: boolean;
  showRescheduleCount?: boolean;
  secondaryText?: string;
  reserveFocusColumn?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function TaskItem({ task, onFocus, isFocus = false, focusDates, showDomain = true, showRescheduleCount = false, secondaryText, reserveFocusColumn = false, expanded, onExpandedChange }: TaskItemProps) {
  const { data, updateTask, transitionTask, rescheduleTask } = useOpenEnds();
  const [localOpen, setLocalOpen] = useState(false);
  const [deferTo, setDeferTo] = useState("");
  const open = expanded === undefined ? localOpen : expanded;
  const done = task.status === "done";
  const canRestore = done || task.status === "dropped";
  const movedCount = rescheduleCount(task.id, data.taskEvents);
  const hasHistoricalFocus = Boolean(focusDates?.length);
  const sourceLink = data.sparkLinks.find(link => link.targetType === "task" && link.targetId === task.id);
  const source = sourceLink ? data.sparks.find(spark => spark.id === sourceLink.sparkId) : undefined;

  function setOpen(next: boolean) {
    if (expanded === undefined) setLocalOpen(next);
    onExpandedChange?.(next);
  }

  function changeStatus(status: Task["status"]) {
    setOpen(false);
    transitionTask(task.id, status);
  }

  return (
    <Card className={`task ${done ? "task-done" : ""}`}>
      <div className="task-main">
        <button
          className="status-button"
          aria-label={canRestore ? "恢复任务" : "完成任务"}
          onClick={() => changeStatus(canRestore ? "open" : "done")}
        >{done ? "✓" : "○"}</button>
        <button className="task-title" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ContextualTaskTitle title={task.title}/>
        </button>
        {onFocus ? (
          <button
            className={`focus-mark ${isFocus ? "" : "empty"}`.trim()}
            aria-label={isFocus ? "今日核心" : "设为今日最重要"}
            onClick={() => onFocus(task.id)}
          ><FocusIcon active={isFocus} /></button>
        ) : hasHistoricalFocus ? (
          <span
            className="focus-mark is-readonly"
            aria-label={`Focus 事件：${focusDates?.join("、")}`}
            title={`Focus 事件：${focusDates?.join("、")}`}
          ><FocusIcon active /></span>
        ) : reserveFocusColumn ? (
          <span className="focus-mark focus-mark-placeholder" aria-hidden="true" />
        ) : null}
        {showRescheduleCount && movedCount > 0 ? <span className={`task-reschedule-count task-reschedule-${Math.min(movedCount,3)}`}>延期 {movedCount} 次</span> : null}
        {secondaryText ? <span className="task-secondary-text">{secondaryText}</span> : null}
        {showDomain ? <span className="pill">{taskDomainLabels[task.domain]}</span> : null}
      </div>
      {open && (
        <div className="task-detail">
          {task.contextPoints.length > 0 ? <section className="task-context" aria-label="任务上下文"><span>任务上下文</span><ul>{task.contextPoints.map((point,index)=><li key={`${task.id}-context-${index}`}>{point}</li>)}</ul></section> : null}
          {source ? <div className="source-spark"><span>来源</span><Link href={`/spark?id=${encodeURIComponent(source.id)}`}>闪念 · {new Date(source.createdAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</Link></div> : null}
          <label className="label">标题
            <input className="field" value={task.title} onChange={e => updateTask(task.id, { title: e.target.value })} />
          </label>
          <div className="row task-fields">
            <SelectMenu label="领域" value={task.domain} onChange={value=>updateTask(task.id,{domain:value as TaskDomain})} options={taskDomainOptions.map(([value,label])=>({value,label}))}/>
            <label className="label">计划日期
              <input className="field" type="date" value={task.plannedDate ?? ""} onChange={e => updateTask(task.id, { plannedDate: e.target.value })} />
            </label>
          </div>
          <div className="task-actions">
            {task.status!=="dropped"?<div className="defer-group">
              <div className="action-label"><strong>调整安排</strong></div>
              <div className="defer-quick-options">
                <Button type="button" variant="ghost" onClick={() => { rescheduleTask(task.id, deferDates.tomorrow()); setOpen(false); }}><span aria-hidden="true">↗</span>明天</Button>
                <Button type="button" variant="ghost" onClick={() => { rescheduleTask(task.id, deferDates.nextWeek()); setOpen(false); }}><span aria-hidden="true">↷</span>下周</Button>
                <Button type="button" variant="ghost" className="defer-someday" onClick={() => { rescheduleTask(task.id); setOpen(false); }}><span aria-hidden="true">∞</span>某天</Button>
              </div>
              <div className="defer-custom">
                <label className="sr-only" htmlFor={`defer-date-${task.id}`}>自定义延期日期</label>
                <input id={`defer-date-${task.id}`} className="field" type="date" value={deferTo} onChange={e => setDeferTo(e.target.value)} aria-label="暂缓到指定日期" />
                <Button type="button" variant="ghost" disabled={!deferTo} onClick={() => { if (!deferTo) return; rescheduleTask(task.id, deferTo); setOpen(false); }}>指定日期</Button>
              </div>
            </div>:null}
            <div className={`task-secondary-actions ${task.status === "dropped" ? "is-restore" : "is-abandon"}`}>
              <span className="secondary-action-copy"><strong>{task.status === "dropped" ? "还想继续吗？" : "不再继续"}</strong></span>
              {task.status === "dropped" ? <Button type="button" variant="secondary" onClick={() => changeStatus("open")}>恢复为未了</Button> : <Button type="button" variant="danger" onClick={() => changeStatus("dropped")}>放下这件事</Button>}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
