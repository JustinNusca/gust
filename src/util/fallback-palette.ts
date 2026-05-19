import type { ParsedFigma } from "#action/parse-figma-response";
import { formatRgba } from "#util/color-format";
import { collectSolidFillStyles } from "#util/figma-styles";
import { sanitizeName } from "#util/names";
import type { PaletteEntry, ResolvedPalette } from "#util/palette";

/**
 * Builds a flat core-only palette from solid FILL document styles. Used by
 * the orchestrator when `resolvePalette` returns empty — the file still
 * produces a usable palette without COLOR variables, but with no semantic
 * layer and no theme modes. Names are sanitized and deduplicated; entries
 * whose name collapses to an empty string are dropped.
 *
 * Shape matches `ResolvedPalette` so the writer, effects, and gradients
 * can consume either palette uniformly. Only the default mode is emitted
 * (with empty `entries`), and `semanticByValue` is empty — fallbacks have
 * no semantic layer and no additional theme modes.
 */
export const resolveFallbackPalette = (
  parsed: ParsedFigma,
): ResolvedPalette => {
  const coreEntries: PaletteEntry[] = [];
  const seenNames = new Set<string>();
  for (const { name, color } of collectSolidFillStyles(parsed)) {
    const cssName = sanitizeName(name);
    if (cssName === "" || seenNames.has(cssName)) continue;
    seenNames.add(cssName);
    coreEntries.push({ name: cssName, value: formatRgba(color) });
  }

  return {
    isEmpty: coreEntries.length === 0,
    core: coreEntries,
    modes: [{ name: parsed.themes.default, isDefault: true, entries: [] }],
    semanticByValue: new Map(),
  };
};
