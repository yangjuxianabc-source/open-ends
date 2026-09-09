"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { readAppearanceSettings, type AppearanceSettings } from "@/lib/settings/appearance";
import { useOpenEndsUI } from "@/ui/core/ui-bridge";
import { getAvailableEditions, getEdition } from "@/ui/editions/edition-registry";
import { getAvailableThemes, getTheme } from "@/ui/themes/theme-registry";
import { isThemeCompatible } from "@/ui/themes/theme-validator";
import { applyThemeTokens } from "@/ui/themes/theme-runtime";
import { resolveAppearanceSettings } from "./appearance-fallback";
import type { EditionDefinition } from "@/ui/editions/contracts";
import type { ThemeDefinition } from "@/ui/themes/contracts";

interface AppearanceContextValue {
  settings: AppearanceSettings;
  storedSettings: AppearanceSettings;
  editionId: string;
  themeId: string;
  edition: EditionDefinition;
  theme: ThemeDefinition;
  availableEditions: readonly EditionDefinition[];
  availableThemes: readonly ThemeDefinition[];
  fallbackReasons: string[];
  setEdition: (id: string) => void;
  setTheme: (id: string) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { data, actions } = useOpenEndsUI();
  const storedSettings = useMemo(() => readAppearanceSettings(data.appSettings), [data.appSettings]);
  const resolved = useMemo(() => resolveAppearanceSettings(storedSettings), [storedSettings]);
  const availableEditions = getAvailableEditions();
  const availableThemes = useMemo(
    () => getAvailableThemes().filter(theme => resolved.edition.supportedThemeIds.includes(theme.manifest.id) && isThemeCompatible(theme, resolved.edition.id)),
    [resolved.edition],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.edition = resolved.edition.id;
    root.dataset.theme = resolved.theme.manifest.id;
    applyThemeTokens(root.style, resolved.theme);
  }, [resolved]);

  const persist = useCallback((next: AppearanceSettings) => {
    actions.setAppearanceSettings(next);
  }, [actions]);

  const setEdition = useCallback((id: string) => {
    const nextEdition = getEdition(id);
    if (!nextEdition) return;
    const currentTheme = getTheme(storedSettings.themeId);
    const keepTheme = currentTheme
      && nextEdition.supportedThemeIds.includes(currentTheme.manifest.id)
      && isThemeCompatible(currentTheme, nextEdition.id);
    persist({
      ...storedSettings,
      editionId: nextEdition.id,
      themeId: keepTheme ? currentTheme.manifest.id : nextEdition.defaultThemeId,
    });
  }, [persist, storedSettings]);

  const setTheme = useCallback((id: string) => {
    const nextTheme = getTheme(id);
    if (!nextTheme || !resolved.edition.supportedThemeIds.includes(nextTheme.manifest.id) || !isThemeCompatible(nextTheme, resolved.edition.id)) return;
    persist({ ...storedSettings, themeId: nextTheme.manifest.id });
  }, [persist, resolved.edition, storedSettings]);

  const value = useMemo<AppearanceContextValue>(() => ({
    settings: resolved.settings,
    storedSettings: resolved.storedSettings,
    editionId: resolved.edition.id,
    themeId: resolved.theme.manifest.id,
    edition: resolved.edition,
    theme: resolved.theme,
    availableEditions,
    availableThemes,
    fallbackReasons: resolved.fallbackReasons,
    setEdition,
    setTheme,
  }), [availableEditions, availableThemes, resolved, setEdition, setTheme]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
