import type { AIReview, PeriodSnapshot } from "@/types";

export const reviewReportFileName = (snapshot: PeriodSnapshot) =>
  `open-ends-${snapshot.periodType}-${snapshot.periodKey}.md`;

export function generateReviewMarkdown(
  snapshot: PeriodSnapshot,
  review?: AIReview,
) {
  const facts = JSON.parse(snapshot.factsJson) as Record<string, unknown>;
  const tasks = (facts.tasks ?? {}) as Record<string, unknown>;
  const focus = (facts.focus ?? {}) as Record<string, unknown>;
  const reading = (facts.reading ?? {}) as Record<string, unknown>;
  const media = (facts.media ?? {}) as Record<string, unknown>;
  const lines = [
    `# Open Ends · ${label(snapshot.periodType)}回顾`,
    ``,
    `> ${snapshot.periodStart} — ${snapshot.periodEnd}`,
    "",
    "## 事实摘要",
    "",
    `- 完成任务：${String(tasks.completed ?? 0)}`,
    `- 重新安排：${String(tasks.rescheduled ?? 0)}`,
    `- 放下任务：${String(tasks.dropped ?? 0)}`,
    `- Daily Focus：${String(focus.completed ?? 0)} / ${String(focus.assigned ?? 0)}`,
    `- 阅读完成：${String(reading.finished ?? 0)}；影视完成：${String(media.finished ?? 0)}`,
    "",
  ];
  appendItems(lines, "代表性完成", tasks.completedItems);
  appendItems(lines, "重新安排", tasks.rescheduledItems);
  appendItems(lines, "阅读与影视事件", [
    ...(Array.isArray(reading.events) ? reading.events : []),
    ...(Array.isArray(media.events) ? media.events : []),
  ]);
  if (review) {
    lines.push(
      "## AI 回顾",
      "",
      review.content,
      "",
      `生成时间：${review.generatedAt}`,
      `事实版本：${review.sourceHash}`,
      "",
    );
  } else lines.push("## AI 回顾", "", "本周期尚未生成 AI 回顾。", "");
  lines.push(
    "---",
    "由未了 Open Ends 本地事实快照生成。",
    "作为报告导出时不重新调用 AI。",
    "",
  );
  return lines.join("\n");
}

function appendItems(lines: string[], heading: string, value: unknown) {
  if (!Array.isArray(value) || !value.length) return;
  lines.push(`## ${heading}`, "");
  for (const item of value.slice(0, 8))
    lines.push(`- ${typeof item === "string" ? item : JSON.stringify(item)}`);
  lines.push("");
}
function label(type: PeriodSnapshot["periodType"]) {
  return type === "weekly" ? "周度" : type === "monthly" ? "月度" : "年度";
}
