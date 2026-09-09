import { describe, expect, it } from "vitest";
import { graphiteAmberTheme } from "./graphite-amber/manifest";
import { applyThemeTokens } from "./theme-runtime";
import type { ThemeDefinition } from "./contracts";

function createStyle() {
  const values = new Map<string, string>();
  return {
    values,
    removeProperty(name: string) {
      values.delete(name);
      return "";
    },
    setProperty(name: string, value: string) {
      values.set(name, value);
    },
  };
}

describe("theme runtime tokens", () => {
  it("applies validated manifest tokens to the root style", () => {
    const style = createStyle();
    const theme = {
      ...graphiteAmberTheme,
      manifest: {
        ...graphiteAmberTheme.manifest,
        tokens: { ...graphiteAmberTheme.manifest.tokens, "--oe-accent": "#123456" },
      },
    };

    expect(applyThemeTokens(style, theme)).toEqual({ valid: true });
    expect(style.values.get("--oe-accent")).toBe("#123456");
    expect(style.values.get("--oe-text")).toBe(graphiteAmberTheme.manifest.tokens["--oe-text"]);
  });

  it("does not apply tokens from an invalid manifest", () => {
    const style = createStyle();
    style.values.set("--oe-accent", "previous");
    const invalidTheme = {
      ...graphiteAmberTheme,
      manifest: {
        ...graphiteAmberTheme.manifest,
        tokens: { ...graphiteAmberTheme.manifest.tokens, "--oe-not-allowed": "bad" },
      },
    } as ThemeDefinition;

    const result = applyThemeTokens(style, invalidTheme);
    expect(result.valid).toBe(false);
    expect(style.values.get("--oe-accent")).toBe("previous");
    expect(style.values.has("--oe-not-allowed")).toBe(false);
  });
});
