import { describe, expect, it } from "vitest";
import { AUXILIARY_ROUTES, MAIN_ROUTE_IDS, auxiliaryRouteIdFromPath, mainRouteIdFromPath } from "@/ui/core/routes";
import { resolveAppearanceSettings } from "@/ui/appearance/appearance-fallback";
import { classicEdition } from "./classic";
import { editionRegistry, getEdition, validateEditionDefinition } from "./edition-registry";

describe("edition registry", () => {
  it("registers Classic for every canonical main route", () => {
    expect(editionRegistry).toContain(classicEdition);
    expect(MAIN_ROUTE_IDS.every(routeId => typeof classicEdition.screens[routeId] === "function")).toBe(true);
  });

  it("keeps auxiliary routes outside the main Edition route contract", () => {
    expect(mainRouteIdFromPath(AUXILIARY_ROUTES.todoPanel)).toBeUndefined();
    expect(auxiliaryRouteIdFromPath(`${AUXILIARY_ROUTES.sparkCapture}/`)).toBe("sparkCapture");
    expect(getEdition("does-not-exist")).toBeUndefined();
  });

  it("falls back safely when a stored edition or theme is unavailable", () => {
    const resolved = resolveAppearanceSettings({ editionId: "missing", themeId: "missing" });
    expect(resolved.edition.id).toBe("classic");
    expect(resolved.theme.manifest.id).toBe("graphite-amber");
    expect(resolved.fallbackReasons).toEqual(["edition-unavailable", "theme-unavailable"]);
  });

  it("rejects an incomplete edition definition", () => {
    const result = validateEditionDefinition({});
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("Shell is required");
  });
});
