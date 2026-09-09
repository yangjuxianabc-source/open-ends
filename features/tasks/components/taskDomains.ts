import type { TaskDomain } from "@/types";

export const taskDomainLabels: Record<TaskDomain, string> = {
  work: "工作",
  study: "学习",
  creation: "创作",
  project: "项目",
  reading: "阅读",
  life: "生活",
  health: "健康",
  relationship: "关系",
  leisure: "娱乐",
  other: "其他",
};

export const taskDomainOptions = Object.entries(taskDomainLabels) as Array<[TaskDomain, string]>;
