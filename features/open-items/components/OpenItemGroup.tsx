import { TaskList } from "@/features/tasks/components/TaskList";import type { Task } from "@/types";
export function OpenItemGroup({ title, tasks, listId, editingKey, onEditingKeyChange, getSecondaryText, focusTaskId, focusTaskIds, focusDatesByTask, onFocus, reserveFocusColumn = false }: { title: string; tasks: Task[]; listId: string; editingKey: string | null; onEditingKeyChange: (key: string | null) => void; getSecondaryText: (task: Task) => string | undefined; focusTaskId?: string; focusTaskIds?: readonly string[]; focusDatesByTask?: Readonly<Record<string, readonly string[]>>; onFocus?: (id: string) => void; reserveFocusColumn?: boolean }) {
  return (
    <section className="open-subgroup">
      <div className="open-subgroup-title"><h2>{title}</h2><span>{tasks.length}</span></div>
      <TaskList tasks={tasks} showDomain={false} showRescheduleCount getSecondaryText={getSecondaryText} reserveFocusColumn={reserveFocusColumn} listId={listId} editingKey={editingKey} onEditingKeyChange={onEditingKeyChange} focusTaskId={focusTaskId} focusTaskIds={focusTaskIds} focusDatesByTask={focusDatesByTask} onFocus={onFocus} />
    </section>
  );
}
