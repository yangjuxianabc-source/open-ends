import type { PeriodSnapshot, PeriodType } from "@/types";
import { DEEPSEEK_REQUEST_DEFAULTS } from "@/lib/ai/deepseek";
import type { ReviewGenerationInput } from "./comparison";

const limits: Record<PeriodType, string> = {
  weekly: "200～300 个中文字符，3～4 个栏目",
  monthly: "300～600 个中文字符，3～5 个栏目",
  yearly: "500～1000 个中文字符，4～6 个栏目",
};
const labels: Record<PeriodType, string> = {
  weekly: "一周",
  monthly: "一个月",
  yearly: "一年",
};

export const REVIEW_SYSTEM_PROMPT = `你是“未了 Open Ends”的生活轨迹编辑。

你的任务是把已经发生的真实行动写成用户未来愿意重新读一遍的生活片段。你不是工作周报机器人，也不是心理咨询师。

严格规则：
1. 只能依据输入的当前事实与历史对照，不能虚构事件，不能把推断写成事实。
2. 不做人格诊断，不使用“拖延症、完美主义、自律、内向、外向”等永久标签。
3. 不逐条复述任务，不把统计数字重新念成报告，不使用列表、编号或表格。
4. 用 3～4 个有意义的 Markdown 二级标题组织内容；标题要随事实自然命名，不要机械套用“总结一/行为分析/改进建议”。每个栏目写一小段，不要把一段话拆成很多短句。
5. 关注注意力从哪里转向哪里、持续或反复延期的项目、慢慢放下的事情、新出现的兴趣、Daily Focus 选择、行动节奏与不同领域占比的变化；区分延续、转向与暂时波动。
6. 写得像熟悉用户生活的人在做温和记录，不使用“总体来看、值得注意的是、你展现出、这表明、综上所述”等报告腔套话，也不要把用户称为“个体/使用者”。
7. 有人味但不煽情、不鸡汤、不夸大成长；证据不足时保持克制，不硬凑栏目。
8. “补记完成”只表示用户补充了过去读过或看过的对象，不代表在当前周期完成；不得用补记记录推断阅读或观看速度、周期节奏或最近完成。
9. 只输出严格 JSON：{"content":"..."}，不得输出 Markdown code fence、解释或额外字段。`;

export function buildReviewPrompt(
  snapshot: PeriodSnapshot,
  input: ReviewGenerationInput,
) {
  return {
    ...DEEPSEEK_REQUEST_DEFAULTS,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      {
        role: "user",
        content: `请回望${labels[snapshot.periodType]}（${snapshot.periodStart}—${snapshot.periodEnd}）。输出${limits[snapshot.periodType]}。用 Markdown 二级标题分栏目，每个栏目只保留和这段生活有关的内容；不要为了凑数量写空泛的话。事实中的 backfilledFinished 只代表补记，不得计入本期完成或速度。当前事实与历史对照如下：\n${JSON.stringify(input)}`,
      },
    ],
  };
}

export const reviewLengthGuidance = (type: PeriodType) => limits[type];
