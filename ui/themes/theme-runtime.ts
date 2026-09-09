import { SEMANTIC_TOKEN_NAMES, type ThemeDefinition } from "./contracts";
import { validateThemeDefinition, type ThemeValidationResult } from "./theme-validator";

type ThemeTokenStyle = Pick<CSSStyleDeclaration, "removeProperty" | "setProperty">;

/** Apply only validator-approved semantic tokens to the document root. */
export function applyThemeTokens(style: ThemeTokenStyle, theme: ThemeDefinition): ThemeValidationResult {
  const validation = validateThemeDefinition(theme);
  if (!validation.valid) return validation;

  for (const tokenName of SEMANTIC_TOKEN_NAMES) style.removeProperty(tokenName);
  for (const tokenName of SEMANTIC_TOKEN_NAMES) {
    const value = theme.manifest.tokens[tokenName];
    if (typeof value === "string") style.setProperty(tokenName, value);
  }
  return validation;
}
