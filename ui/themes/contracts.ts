export const ICON_SLOTS = [
  "brand",
  "today",
  "spark",
  "month",
  "monthDone",
  "monthOpen",
  "monthRescheduled",
  "open",
  "review",
  "reading",
  "media",
  "settings",
  "focus",
  "complete",
  "restore",
  "archive",
] as const;

export type IconSlot = (typeof ICON_SLOTS)[number];

export const ASSET_SLOTS = [
  "brandMark",
  "appBackground",
  "surfaceTexture",
  "focusDecoration",
  "emptyIllustration",
  "windowDecoration",
] as const;

export type AssetSlot = (typeof ASSET_SLOTS)[number];

export const SEMANTIC_TOKEN_NAMES = [
  "--oe-bg",
  "--oe-bg-deep",
  "--oe-surface",
  "--oe-surface-muted",
  "--oe-surface-raised",
  "--oe-text",
  "--oe-text-strong",
  "--oe-text-muted",
  "--oe-text-faint",
  "--oe-primary",
  "--oe-primary-hover",
  "--oe-primary-soft",
  "--oe-accent",
  "--oe-accent-soft",
  "--oe-danger",
  "--oe-border",
  "--oe-border-strong",
  "--oe-shadow",
  "--oe-shadow-soft",
  "--oe-radius-xs",
  "--oe-radius-sm",
  "--oe-radius-md",
  "--oe-radius-lg",
  "--oe-radius-xl",
  "--oe-font-ui",
  "--oe-font-display",
  "--oe-font-mono",
  "--oe-motion-fast",
  "--oe-motion-normal",
  "--oe-motion-slow",
  "--oe-motion-micro",
  "--oe-motion-ui",
  "--oe-motion-layout",
  "--oe-ease-standard",
  "--oe-ease-emphasized",
  "--oe-main-window-canvas",
  "--oe-page-canvas",
  "--oe-page-lead-gap",
  "--oe-page-scroll-fade-height",
  "--oe-focus-surface",
  "--oe-focus-surface-done",
  "--oe-focus-border",
  "--oe-titlebar-visual-height",
  "--oe-titlebar-hit-height",
  "--oe-todo-window-surface",
  "--oe-todo-window-backdrop",
  "--oe-spark-window-surface",
  "--oe-spark-window-backdrop",
] as const;

export type SemanticTokenName = (typeof SEMANTIC_TOKEN_NAMES)[number];

export interface ThemeIconDefinition {
  viewBox: string;
  paths: string[];
}

export interface ThemeManifest {
  apiVersion: 1;
  id: string;
  name: string;
  version: string;
  author?: string;
  kind?: "official" | "community";
  compatibleEditions: string[];
  tokens: Record<string, string>;
  icons?: Record<string, ThemeIconDefinition>;
  assets?: Record<string, string>;
}

export interface ThemeDefinition {
  manifest: ThemeManifest;
  icons: Partial<Record<IconSlot, ThemeIconDefinition>>;
  assets: Partial<Record<AssetSlot, string>>;
}

export function isIconSlot(value: string): value is IconSlot {
  return (ICON_SLOTS as readonly string[]).includes(value);
}

export function isAssetSlot(value: string): value is AssetSlot {
  return (ASSET_SLOTS as readonly string[]).includes(value);
}
