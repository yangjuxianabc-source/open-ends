import {monthRange} from "@/lib/dates";
import {monthlyTaskStats} from "@/lib/stats";
import type {DailyFocus,ReadingEvent,ReadingItem,Task,TaskDomain,TaskEvent} from "@/types";

const DOMAIN_LABELS:Record<TaskDomain,string>={work:"工作",study:"学习",creation:"创作",project:"项目",life:"生活",health:"健康",relationship:"关系",reading:"阅读",leisure:"娱乐",other:"其他"};
export interface MonthlyReportInput{tasks:Task[];taskEvents:TaskEvent[];dailyFocus:DailyFocus[];readingItems:ReadingItem[];readingEvents:ReadingEvent[]}
export const monthlyReportFileName=(year:number,month:number)=>`open-ends-${year}-${String(month+1).padStart(2,"0")}.md`;

export function generateMonthlyReport(input:MonthlyReportInput,year:number,month:number){
  const {start,end}=monthRange(year,month);const stats=monthlyTaskStats(input.tasks,input.taskEvents,year,month,input.dailyFocus);
  const completedIds=new Set(input.taskEvents.filter(event=>event.type==="completed"&&event.localDate>=start&&event.localDate<=end).map(event=>event.taskId));
  const completed=input.tasks.filter(task=>completedIds.has(task.id));const open=input.tasks.filter(task=>task.status==="open"&&task.plannedDate&&task.plannedDate>=start&&task.plannedDate<=end);
  const readingFinished=new Set(input.readingEvents.filter(event=>event.type==="finished"&&event.localDate>=start&&event.localDate<=end).map(event=>event.readingItemId));
  const readingById=new Map(input.readingItems.map(item=>[item.id,item]));const lines=[`# Open Ends · ${year} 年 ${month+1} 月`,"",`> ${start} — ${end}`,"","## 事实摘要","",`- 唯一完成任务：${stats.done}`,`- 重新安排事件：${stats.rescheduled}`,`- 周期内首次放下：${stats.dropped}`,`- Daily Focus：${stats.focus.completed} / ${stats.focus.assigned}`,""];
  const domains=Object.entries(stats.domains).filter(([,count])=>count>0);if(domains.length){lines.push("## 生活分布","");for(const [domain,count] of domains)lines.push(`- ${DOMAIN_LABELS[domain as TaskDomain]}：${count}`);lines.push("")}
  if(completed.length){lines.push("## 已完成","");for(const task of completed)lines.push(`- ${task.title}（${DOMAIN_LABELS[task.domain]}）`);lines.push("")}
  if(open.length){lines.push("## 仍然未了","");for(const task of open)lines.push(`- ${task.title}（${task.plannedDate}）`);lines.push("")}
  if(readingFinished.size){lines.push("## 阅读完成","");for(const id of readingFinished){const item=readingById.get(id);if(item)lines.push(`- ${item.title}${item.author?` · ${item.author}`:""}`)}lines.push("")}
  lines.push("---","由未了 Open Ends 本地事实数据生成。未调用 AI。","");return lines.join("\n");
}
