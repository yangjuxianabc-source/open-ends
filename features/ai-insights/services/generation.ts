import { sha256Hex, stableStringify } from "@/lib/crypto/hash";
import { deepseekRequest } from "@/lib/desktop/tauri-client";
import { DEEPSEEK_REQUEST_DEFAULTS } from "@/lib/ai/deepseek";
import type { ProfileSnapshot } from "@/types";
import type { ProfileEvidencePack } from "./evidence";
import { buildProfilePrompt } from "./prompts";
import { parseGeneratedContent } from "@/features/reviews/services/generation";

interface DeepSeekResponse {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
}

export async function generateProfile(
  pack: ProfileEvidencePack,
  now = new Date().toISOString(),
  id = crypto.randomUUID(),
): Promise<ProfileSnapshot> {
  const response = await deepseekRequest<DeepSeekResponse>(
    buildProfilePrompt(pack),
  );
  const text = response.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("UPSTREAM_INVALID_RESPONSE");
  return {
    id,
    evidenceEnd: pack.evidenceEnd,
    revision: 1,
    provider: "deepseek",
    model:
      typeof response.model === "string" && response.model.trim()
        ? response.model
        : DEEPSEEK_REQUEST_DEFAULTS.model,
    sourceHash: await sha256Hex(stableStringify(pack)),
    evidenceJson: stableStringify(pack),
    content: parseGeneratedContent(text),
    generatedAt: now,
  };
}

export function nextProfileRevision(
  profiles: ProfileSnapshot[],
  evidenceEnd: string,
) {
  return (
    Math.max(
      0,
      ...profiles
        .filter((profile) => profile.evidenceEnd === evidenceEnd)
        .map((profile) => profile.revision),
    ) + 1
  );
}
export function latestProfile(profiles: ProfileSnapshot[]) {
  return [...profiles].sort(
    (a, b) =>
      b.generatedAt.localeCompare(a.generatedAt) || b.revision - a.revision,
  )[0];
}
export function isProfileStale(
  profile: ProfileSnapshot | undefined,
  currentSourceHash: string,
) {
  return Boolean(profile && profile.sourceHash !== currentSourceHash);
}
