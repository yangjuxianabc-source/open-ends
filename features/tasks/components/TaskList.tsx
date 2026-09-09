"use client";
import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Task } from "@/types";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  empty?: string;
  onFocus?: (id: string) => void;
  focusTaskId?: string;
  focusTaskIds?: readonly string[];
  focusDatesByTask?: Readonly<Record<string, readonly string[]>>;
  showDomain?: boolean;
  showRescheduleCount?: boolean;
  getSecondaryText?: (task: Task) => string | undefined;
  reserveFocusColumn?: boolean;
  listId?: string;
  editingKey?: string | null;
  onEditingKeyChange?: (key: string | null) => void;
}

export function TaskList({ tasks, empty = "这里暂时没有悬着的事。", onFocus, focusTaskId, focusTaskIds, focusDatesByTask, showDomain = true, showRescheduleCount = false, getSecondaryText, reserveFocusColumn = false, listId = "tasks", editingKey, onEditingKeyChange }: TaskListProps) {
  const [localEditingKey, setLocalEditingKey] = useState<string | null>(null);
  const currentEditingKey = editingKey === undefined ? localEditingKey : editingKey;
  function setEditingKey(key: string | null) {
    if (editingKey === undefined) setLocalEditingKey(key);
    onEditingKeyChange?.(key);
  }
  return tasks.length
    ? <div className="stack">{tasks.map(t => {
      const itemKey = `${listId}:${t.id}`;
      return <TaskItem key={t.id} task={t} onFocus={onFocus} isFocus={focusTaskId === t.id || Boolean(focusTaskIds?.includes(t.id))} focusDates={focusDatesByTask?.[t.id]} showDomain={showDomain} showRescheduleCount={showRescheduleCount} secondaryText={getSecondaryText?.(t)} reserveFocusColumn={reserveFocusColumn} expanded={currentEditingKey === itemKey} onExpandedChange={open => setEditingKey(open ? itemKey : null)} />;
    })}</div>
    : <EmptyState>{empty}</EmptyState>;
}
