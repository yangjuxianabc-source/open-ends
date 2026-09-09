import { deepseekRequest } from "@/lib/desktop/tauri-client";
import { sha256Hex } from "@/lib/crypto/hash";
import { DEEPSEEK_REQUEST_DEFAULTS } from "@/lib/ai/deepseek";
import type { SparkPromptContext } from "./prompt";
import { buildSparkPrompt } from "./prompt";
import { parseSparkAnalysisText } from "./schema";
import type { SparkAnalysisResult } from "../types";
import { assignSparkDraftDates } from "./schedule";

interface DeepSeekResponse {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
}

export interface SparkAnalysisDraft {
  result: SparkAnalysisResult;
  resultJson: string;
  sourceHash: string;
  provider: "deepseek";
  model: string;
}

export async function analyzeSparkContent(content: string, context: SparkPromptContext): Promise<SparkAnalysisDraft> {
  const source = content.trim();
  if (!source) throw new Error("SPARK_CONTENT_EMPTY");
  const response = await deepseekRequest<DeepSeekResponse>(buildSparkPrompt(source, context));
  const message = response.choices?.[0]?.message?.content;
  if (typeof message !== "string" || !message.trim()) throw new Error("UPSTREAM_INVALID_RESPONSE");
  const result = assignSparkDraftDates(parseSparkAnalysisText(message), context.today, context.tasks);
  return {
    result,
    resultJson: JSON.stringify(result),
    sourceHash: await sha256Hex(source),
    provider: "deepseek",
    model: typeof response.model === "string" && response.model.trim() ? response.model : DEEPSEEK_REQUEST_DEFAULTS.model,
  };
}
