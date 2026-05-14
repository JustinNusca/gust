import type { RGB, RGBA } from "@figma/rest-api-spec";

import type { ParsedFigma } from "#action/parse-figma-response";
import { formatRgba } from "#util/color-format";
import {
  classifyVariables,
  isRgb,
  pickVariableValue,
  pickVariableValueWithFallback,
} from "#util/figma-variables";
import { sanitizeName } from "#util/names";
import type {
  ResolvedTokenDomain,
  TokenEntry,
  TokenMode,
} from "#util/resolved";

export type PaletteEntry = TokenEntry;
export type PaletteMode = TokenMode<PaletteEntry>;

export interface ResolvedPalette extends ResolvedTokenDomain<PaletteEntry> {
  /**
   * Lookup of every semantic default-mode color, keyed by its underlying
   * `rgba(...)` string (before any `var(--core-*)` rewrite). Each entry lists
   * every semantic token name that shares that color, in iteration order, so
   * downstream resolvers (e.g. shadows) can pick a domain-appropriate name
   * rather than being stuck with whichever happened to be first. Empty for
   * fill-style fallbacks, which have no semantic layer.
   */
  semanticByValue: Map<string, string[]>;
}

/**
 * Resolves a `ParsedFigma` into a writer-ready palette built purely from
 * COLOR variables. Classifies them into core vs. semantic, formats every
 * value as an `rgba(...)` string, and deduplicates by replacing any semantic
 * value that matches a core value with a `var(--core-{name})` reference.
 *
 * Core tokens are emitted with a single (default-mode) value — they're
 * intended as mode-agnostic primitives. Semantic tokens are emitted once for
 * the default theme and once per additional mode that has at least one
 * color value. Mode names are sanitized for use as CSS identifiers.
 *
 * When no COLOR variables exist at all, returns an empty `ResolvedPalette`;
 * the orchestrator then falls back to `resolveFallbackPalette` to harvest
 * solid FILL document styles as a flat core palette.
 */
export const resolvePalette = (parsed: ParsedFigma): ResolvedPalette => {
  const { core, semantic } = classifyVariables(
    parsed.variables,
    (variable) => variable.resolvedType === "COLOR",
  );
  const { default: defaultMode, others } = parsed.themes;

  const coreEntries: PaletteEntry[] = [];
  const coreByValue = new Map<string, string>();
  for (const [tokenName, variable] of core) {
    const value = pickVariableValueWithFallback(variable, defaultMode, isRgb);
    if (value === null) continue;
    const formatted = formatRgba(value);
    coreEntries.push({ name: tokenName, value: formatted });
    if (!coreByValue.has(formatted)) coreByValue.set(formatted, tokenName);
  }

  const renderSemantic = (color: RGB | RGBA): string => {
    const formatted = formatRgba(color);
    const coreName = coreByValue.get(formatted);
    return coreName ? `var(--core-${coreName})` : formatted;
  };

  const defaultEntries: PaletteEntry[] = [];
  const semanticByValue = new Map<string, string[]>();
  for (const [tokenName, variable] of semantic) {
    const value = pickVariableValueWithFallback(variable, defaultMode, isRgb);
    if (value !== null) {
      const formatted = formatRgba(value);
      const names = semanticByValue.get(formatted);
      if (names) names.push(tokenName);
      else semanticByValue.set(formatted, [tokenName]);
      defaultEntries.push({ name: tokenName, value: renderSemantic(value) });
    }
  }

  const modes: PaletteMode[] = [
    { name: defaultMode, isDefault: true, entries: defaultEntries },
  ];
  for (const mode of others) {
    const entries: PaletteEntry[] = [];
    for (const [tokenName, variable] of semantic) {
      const value = pickVariableValue(variable, mode, isRgb);
      if (value !== null) {
        entries.push({ name: tokenName, value: renderSemantic(value) });
      }
    }
    if (entries.length === 0) continue;
    modes.push({ name: sanitizeName(mode), isDefault: false, entries });
  }

  return {
    isEmpty:
      coreEntries.length === 0 &&
      modes.every((mode) => mode.entries.length === 0),
    core: coreEntries,
    modes,
    semanticByValue,
  };
};
