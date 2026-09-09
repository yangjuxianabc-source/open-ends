import type {DailyFocus,Task} from "@/types";

export interface TodoPanelViewModel {
  focus?: Task;
  others: Task[];
}

export function getTodoPanelViewModel(tasks:Task[],dailyFocus:DailyFocus[],today:string):TodoPanelViewModel{
  const todayTasks=tasks.filter(task=>task.plannedDate===today&&task.status!=="dropped");
  const focusId=dailyFocus.find(item=>item.date===today)?.taskId;
  const focus=focusId?todayTasks.find(task=>task.id===focusId):undefined;
  const others=todayTasks.filter(task=>task.status==="open"&&task.id!==focusId);
  return {focus,others};
}
