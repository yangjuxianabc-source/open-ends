import { MAIN_ROUTE_IDS } from "@/ui/core/routes";
import { classicEdition } from "./classic";
import type { EditionDefinition } from "./contracts";

const BUILT_IN_EDITIONS: EditionDefinition[] = [classicEdition];
const EDITION_MAP = new Map(BUILT_IN_EDITIONS.map(edition => [edition.id, edition]));

export const editionRegistry = Object.freeze(BUILT_IN_EDITIONS);

export function getEdition(id: string | undefined) {
  return id ? EDITION_MAP.get(id) : undefined;
}

export function getAvailableEditions() {
  return editionRegistry;
}

export function validateEditionDefinition(input: unknown) {
  if (!input || typeof input !== "object") return { valid: false as const, errors: ["edition must be an object"] };
  const value = input as Partial<EditionDefinition>;
  const errors: string[] = [];
  if (typeof value.id !== "string" || !value.id.trim()) errors.push("id is required");
  if (value.apiVersion !== 1) errors.push("apiVersion must be 1");
  if (typeof value.name !== "string" || !value.name.trim()) errors.push("name is required");
  if (typeof value.defaultThemeId !== "string" || !value.defaultThemeId.trim()) errors.push("defaultThemeId is required");
  if (!Array.isArray(value.supportedThemeIds) || value.supportedThemeIds.some(themeId => typeof themeId !== "string" || !themeId.trim())) errors.push("supportedThemeIds must be a string array");
  if (!MAIN_ROUTE_IDS.includes(value.homeRoute as (typeof MAIN_ROUTE_IDS)[number])) errors.push("homeRoute must be a canonical route");
  if (typeof value.Shell !== "function") errors.push("Shell is required");
  if (!value.screens || typeof value.screens !== "object") errors.push("screens are required");
  if (!Array.isArray(value.navigation)) errors.push("navigation is required");
  if (!value.auxiliaryRenderers || typeof value.auxiliaryRenderers !== "object") errors.push("auxiliaryRenderers are required");
  return errors.length ? { valid: false as const, errors } : { valid: true as const };
}

for (const edition of editionRegistry) {
  const result = validateEditionDefinition(edition);
  if (!result.valid) throw new Error(`Invalid built-in edition ${edition.id}: ${result.errors.join(", ")}`);
}
