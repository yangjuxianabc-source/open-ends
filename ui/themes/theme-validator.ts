import {
  ASSET_SLOTS,
  ICON_SLOTS,
  SEMANTIC_TOKEN_NAMES,
  type ThemeDefinition,
  type ThemeIconDefinition,
  type ThemeManifest,
} from "./contracts";

export type ThemeValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

const MANIFEST_KEYS = new Set([
  "apiVersion",
  "id",
  "name",
  "version",
  "author",
  "kind",
  "compatibleEditions",
  "tokens",
  "icons",
  "assets",
]);
const TOKEN_KEYS = new Set(SEMANTIC_TOKEN_NAMES);
const ICON_KEYS = new Set(ICON_SLOTS);
const ASSET_KEYS = new Set(ASSET_SLOTS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateIcon(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value) || typeof value.viewBox !== "string" || !Array.isArray(value.paths) || value.paths.some(pathValue => typeof pathValue !== "string")) {
    errors.push(`${path} must contain a viewBox and string paths`);
  }
}

export function validateThemeManifest(input: unknown): ThemeValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["manifest must be an object"] };

  for (const key of Object.keys(input)) {
    if (!MANIFEST_KEYS.has(key)) errors.push(`unknown manifest field: ${key}`);
  }
  if (input.apiVersion !== 1) errors.push("apiVersion must be 1");
  if (typeof input.id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(input.id)) errors.push("id must be a safe lowercase identifier");
  if (typeof input.name !== "string" || !input.name.trim()) errors.push("name is required");
  if (typeof input.version !== "string" || !input.version.trim()) errors.push("version is required");
  if (input.kind !== undefined && input.kind !== "official" && input.kind !== "community") errors.push("kind must be official or community");
  if (!Array.isArray(input.compatibleEditions) || input.compatibleEditions.some(value => typeof value !== "string" || !value.trim())) errors.push("compatibleEditions must be a string array");

  if (!isRecord(input.tokens)) {
    errors.push("tokens must be an object");
  } else {
    for (const [key, value] of Object.entries(input.tokens)) {
      if (!TOKEN_KEYS.has(key as (typeof SEMANTIC_TOKEN_NAMES)[number])) errors.push(`invalid semantic token: ${key}`);
      if (typeof value !== "string") errors.push(`token ${key} must be a string`);
    }
  }

  if (input.icons !== undefined) {
    if (!isRecord(input.icons)) errors.push("icons must be an object");
    else for (const [key, value] of Object.entries(input.icons)) {
      if (!ICON_KEYS.has(key as (typeof ICON_SLOTS)[number])) errors.push(`invalid icon slot: ${key}`);
      validateIcon(value, `icons.${key}`, errors);
    }
  }

  if (input.assets !== undefined) {
    if (!isRecord(input.assets)) errors.push("assets must be an object");
    else for (const [key, value] of Object.entries(input.assets)) {
      if (!ASSET_KEYS.has(key as (typeof ASSET_SLOTS)[number])) errors.push(`invalid asset slot: ${key}`);
      if (typeof value !== "string") errors.push(`asset ${key} must be a local asset reference`);
    }
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

export function validateThemeDefinition(input: unknown): ThemeValidationResult {
  if (!isRecord(input)) return { valid: false, errors: ["theme must be an object"] };
  const manifestResult = validateThemeManifest(input.manifest);
  const errors = manifestResult.valid ? [] : [...manifestResult.errors];

  if (!isRecord(input.icons)) errors.push("theme icons must be an object");
  else for (const [key, value] of Object.entries(input.icons)) {
    if (!ICON_KEYS.has(key as (typeof ICON_SLOTS)[number])) errors.push(`invalid icon slot: ${key}`);
    validateIcon(value, `theme.icons.${key}`, errors);
  }
  if (!isRecord(input.assets)) errors.push("theme assets must be an object");
  else for (const [key, value] of Object.entries(input.assets)) {
    if (!ASSET_KEYS.has(key as (typeof ASSET_SLOTS)[number])) errors.push(`invalid asset slot: ${key}`);
    if (value !== undefined && typeof value !== "string") errors.push(`theme asset ${key} must be a string`);
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

export function isThemeCompatible(theme: Pick<ThemeDefinition, "manifest">, editionId: string) {
  return theme.manifest.compatibleEditions.includes(editionId);
}

export function assertValidThemeManifest(manifest: ThemeManifest) {
  const result = validateThemeManifest(manifest);
  if (!result.valid) throw new Error(result.errors.join("; "));
  return manifest;
}

export type { ThemeDefinition, ThemeIconDefinition, ThemeManifest };
