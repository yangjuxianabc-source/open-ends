import { graphiteAmberTheme } from "./graphite-amber/manifest";
import { validateThemeDefinition } from "./theme-validator";
import type { ThemeDefinition } from "./contracts";

const BUILT_IN_THEMES: ThemeDefinition[] = [graphiteAmberTheme];
const THEME_MAP = new Map(BUILT_IN_THEMES.map(theme => [theme.manifest.id, theme]));

for (const theme of BUILT_IN_THEMES) {
  const result = validateThemeDefinition(theme);
  if (!result.valid) throw new Error(`Invalid built-in theme ${theme.manifest.id}: ${result.errors.join(", ")}`);
}

export const themeRegistry = Object.freeze(BUILT_IN_THEMES);

export function getTheme(id: string | undefined) {
  return id ? THEME_MAP.get(id) : undefined;
}

export function getAvailableThemes() {
  return themeRegistry;
}
