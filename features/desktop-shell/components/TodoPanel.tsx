"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TaskInput } from "@/features/tasks/components/TaskInput";
import { toDateKey } from "@/lib/dates";
import {formatChineseDate} from "@/lib/dates";
import { useOpenEnds } from "@/lib/storage/store";
import {
  getTodoPanelPinned,
  setTodoPanelPinned,
  setTodoPanelInteraction,
  showDesktopWindow,
} from "@/lib/desktop/tauri-client";
import { getTodoPanelViewModel } from "../services/todo-panel";
import {ContextualTaskTitle} from "@/features/tasks/components/ContextualTaskTitle";
import {FocusIcon} from "@/components/ui/FocusIcon";

export function TodoPanel() {
  const { data, transitionTask, setDailyFocus } = useOpenEnds();
  const today = toDateKey(new Date());
  const [pinned, setPinned] = useState(false);
  const pointerInside=useRef(false);const focusInside=useRef(false);const pointerDown=useRef(false);
  const { focus, others } = useMemo(
    () => getTodoPanelViewModel(data.tasks, data.dailyFocus, today),
    [data.tasks, data.dailyFocus, today],
  );

  useEffect(() => {
    getTodoPanelPinned().then(setPinned).catch(() => {});
  }, []);

  async function togglePin() {
    try {
      const next = !pinned;
      await setTodoPanelPinned(next);
      setPinned(next);
    } catch {
      // The icon remains unchanged when the native window rejects the update.
    }
  }

  function syncInteraction(){void setTodoPanelInteraction(pointerInside.current,focusInside.current||pointerDown.current).catch(()=>{})}

  return (
    <main className="desktop-mini todo-panel" onPointerEnter={()=>{pointerInside.current=true;syncInteraction()}} onPointerLeave={()=>{pointerInside.current=false;pointerDown.current=false;syncInteraction()}} onPointerDown={()=>{pointerDown.current=true;syncInteraction()}} onPointerUp={()=>{pointerDown.current=false;syncInteraction()}} onFocusCapture={()=>{focusInside.current=true;syncInteraction()}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){focusInside.current=false;syncInteraction()}}}>
      <header className="desktop-mini-head">
        <div className="todo-panel-heading">
          <h1>今天</h1><time>{formatChineseDate(new Date())}</time>
        </div>
        <button
          type="button"
          className={`todo-pin-button ${pinned ? "is-pinned" : ""}`}
          onClick={() => void togglePin()}
          aria-pressed={pinned}
          aria-label={pinned ? "取消置顶" : "置顶"}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 3.25h6l-.65 3.18 2.38 2.38v1.14h-3.62v4.08L10 16.8l-1.11-2.77V9.95H5.27V8.81l2.38-2.38L7 3.25Z" />
            <path d="M10 16.8v-5.7" />
          </svg>
        </button>
      </header>
      <div className="todo-panel-body">
      <section className="mini-section">
        <span className="tiny-label">今日核心</span>
        {focus ? (
          <MiniTask
            task={focus}
            onToggleStatus={() => transitionTask(focus.id, focus.status === "done" ? "open" : "done")}
            onOpen={() => showDesktopWindow("main", "/today")}
            onUnfocus={() => setDailyFocus(today)}
          />
        ) : (
          <p className="mini-empty">还没有选定。</p>
        )}
      </section>
      <section className="mini-section">
        <span className="tiny-label">其他任务</span>
        <div className="mini-task-list">
          {others.map(task => (
            <MiniTask
              key={task.id}
              task={task}
              onToggleStatus={() => transitionTask(task.id, "done")}
              onOpen={() => showDesktopWindow("main", "/today")}
              onFocus={() => setDailyFocus(today, task.id)}
            />
          ))}
        </div>
        {!others.length && <p className="mini-empty">今天暂时没有其他任务。</p>}
      </section>
      <section className="mini-section mini-add">
        <span className="tiny-label">快速添加</span>
        <TaskInput date={today} />
      </section>
      </div>
    </main>
  );
}

function MiniTask({
  task,
  onToggleStatus,
  onOpen,
  onFocus,
  onUnfocus,
}: {
  task: { id: string; title: string; status: "open" | "done" | "dropped" };
  onToggleStatus: () => void;
  onOpen: () => void;
  onFocus?: () => void;
  onUnfocus?: () => void;
}) {
  const done = task.status === "done";
  return (
    <div className={`mini-task ${done ? "task-done" : ""}`}>
      <button className="status-button" onClick={onToggleStatus} aria-label={done ? "恢复任务" : "完成任务"}>{done ? "✓" : "○"}</button>
      <button className="mini-task-title" onClick={onOpen}><ContextualTaskTitle title={task.title}/></button>
      {onFocus && <button className="focus-mark empty" onClick={onFocus} aria-label="设为今日最重要"><FocusIcon /></button>}
      {onUnfocus && <button className="focus-mark" onClick={onUnfocus} aria-label="取消今日最重要"><FocusIcon active /></button>}
    </div>
  );
}
