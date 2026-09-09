import { describe, expect, it } from "vitest";
import { graphiteAmberTheme } from "./graphite-amber/manifest";
import { validateThemeDefinition, validateThemeManifest } from "./theme-validator";

describe("theme contract", () => {
  it("accepts the built-in Graphite Amber theme", () => {
    expect(validateThemeDefinition(graphiteAmberTheme)).toEqual({ valid: true });
  });

  it("rejects missing identity and unknown executable fields", () => {
    const result = validateThemeManifest({ ...graphiteAmberTheme.manifest, id: undefined, runtime: "bad" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("id must be a safe lowercase identifier");
      expect(result.errors).toContain("unknown manifest field: runtime");
    }
  });

  it("rejects invalid icon slots", () => {
    const result = validateThemeDefinition({
      ...graphiteAmberTheme,
      manifest: { ...graphiteAmberTheme.manifest, icons: { ...graphiteAmberTheme.manifest.icons, executable: { viewBox: "0 0 1 1", paths: [] } } },
      icons: { ...graphiteAmberTheme.icons, executable: { viewBox: "0 0 1 1", paths: [] } },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("invalid icon slot: executable");
  });
});
