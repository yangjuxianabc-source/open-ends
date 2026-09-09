import { describe, expect, it } from "vitest";
import { appearanceSettingsToAppSettings, readAppearanceSettings, type AppearanceSettings } from "./appearance";

describe("appearance persistence", () => {
  it("round-trips appearance settings through app_settings", () => {
    const settings: AppearanceSettings = { editionId: "classic", themeId: "graphite-amber" };
    expect(readAppearanceSettings(appearanceSettingsToAppSettings(settings))).toEqual(settings);
  });

  it("ignores removed motion and density values without throwing", () => {
    expect(readAppearanceSettings({ "appearance.motion": "fast", "appearance.density": null })).toEqual({
      editionId: "classic",
      themeId: "graphite-amber",
    });
  });
});
