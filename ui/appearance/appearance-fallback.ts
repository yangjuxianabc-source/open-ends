import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from "@/lib/settings/appearance";
import { getEdition } from "@/ui/editions/edition-registry";
import { getTheme } from "@/ui/themes/theme-registry";
import { isThemeCompatible } from "@/ui/themes/theme-validator";
import type { EditionDefinition } from "@/ui/editions/contracts";
import type { ThemeDefinition } from "@/ui/themes/contracts";

export interface ResolvedAppearance {
  storedSettings: AppearanceSettings;
  settings: AppearanceSettings;
  edition: EditionDefinition;
  theme: ThemeDefinition;
  fallbackReasons: string[];
}

export function resolveAppearanceSettings(storedSettings: AppearanceSettings): ResolvedAppearance {
  const fallbackReasons: string[] = [];
  const edition = getEdition(storedSettings.editionId);
  const activeEdition = edition ?? getEdition(DEFAULT_APPEARANCE_SETTINGS.editionId)!;
  if (!edition) fallbackReasons.push("edition-unavailable");

  const requestedTheme = getTheme(storedSettings.themeId);
  const themeIsCompatible = requestedTheme
    && activeEdition.supportedThemeIds.includes(requestedTheme.manifest.id)
    && isThemeCompatible(requestedTheme, activeEdition.id);
  const activeTheme = themeIsCompatible
    ? requestedTheme
    : getTheme(activeEdition.defaultThemeId) ?? getTheme(DEFAULT_APPEARANCE_SETTINGS.themeId)!;
  if (!requestedTheme) fallbackReasons.push("theme-unavailable");
  else if (!themeIsCompatible) fallbackReasons.push("theme-incompatible");

  return {
    storedSettings,
    settings: {
      ...storedSettings,
      editionId: activeEdition.id,
      themeId: activeTheme.manifest.id,
    },
    edition: activeEdition,
    theme: activeTheme,
    fallbackReasons,
  };
}
