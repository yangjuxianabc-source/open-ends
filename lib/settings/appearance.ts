export interface AppearanceSettings {
  editionId: string;
  themeId: string;
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  editionId: "classic",
  themeId: "graphite-amber",
};

export const APPEARANCE_SETTING_KEYS = {
  editionId: "appearance.edition",
  themeId: "appearance.theme",
} as const;

function readId(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function readAppearanceSettings(appSettings: Record<string, unknown>): AppearanceSettings {
  return {
    editionId: readId(appSettings[APPEARANCE_SETTING_KEYS.editionId], DEFAULT_APPEARANCE_SETTINGS.editionId),
    themeId: readId(appSettings[APPEARANCE_SETTING_KEYS.themeId], DEFAULT_APPEARANCE_SETTINGS.themeId),
  };
}

export function appearanceSettingsToAppSettings(settings: AppearanceSettings) {
  return {
    [APPEARANCE_SETTING_KEYS.editionId]: settings.editionId,
    [APPEARANCE_SETTING_KEYS.themeId]: settings.themeId,
  };
}
