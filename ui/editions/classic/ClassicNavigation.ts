import type { EditionNavigationItem } from "../contracts";

export const classicNavigation: EditionNavigationItem[] = [
  { id: "today", label: "今日", group: "行动", icon: "today" },
  { id: "open", label: "未了", group: "行动", icon: "open" },
  { id: "spark", label: "闪念", group: "行动", icon: "spark" },
  { id: "month", label: "月览", group: "行动", icon: "month" },
  { id: "reading", label: "阅读", group: "记录", icon: "reading" },
  { id: "media", label: "影视", group: "记录", icon: "media" },
  { id: "review", label: "回顾", group: "回望", icon: "review" },
];

export const classicBreadcrumbs: Record<string, string> = {
  "/today": "今日 · TODAY",
  "/spark": "闪念 · SPARK",
  "/month": "月览 · MONTHLY",
  "/open": "未了事项 · OPEN ENDS",
  "/review": "回顾 · REVIEW",
  "/reading": "阅读记录 · READING",
  "/media": "影视记录 · MEDIA",
  "/settings": "设置 · SETTINGS",
};
