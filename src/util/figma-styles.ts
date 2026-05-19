import type { RGBA } from "@figma/rest-api-spec";

import type { ParsedFigma } from "#action/parse-figma-response";
import type { ParsedFigmaStyle } from "#action/parse-figma-styles";
import { formatRgba } from "#util/color-format";
import type { ResolvedPalette } from "#util/palette";

export interface SolidFillStyle {
  name: string;
  color: RGBA;
  remote: boolean;
}

export interface UnaccountableFillStyles {
  local: string[];
  remote: string[];
}

/**
 * Picks the first visible SOLID paint on a FILL document style and folds the
 * paint's `opacity` into the color's alpha. Returns `null` for non-FILL styles
 * and FILL styles whose paints are all hidden, non-solid (gradient/image), or
 * missing.
 */
function pickFillStyleColor(style: ParsedFigmaStyle): RGBA | null {
  if (style.styleType !== "FILL") return null;

  for (const paint of style.fills) {
    if (paint.visible === false) continue;
    if (paint.type !== "SOLID") continue;
    const opacity = paint.opacity ?? 1;
    return { ...paint.color, a: paint.color.a * opacity };
  }
  return null;
}

/**
 * Walks the parsed document styles and collects every FILL style that resolves
 * to a single visible SOLID paint. Shared by `resolveFallbackPalette` (which
 * synthesizes a flat core palette when no COLOR variables exist) and
 * `resolveUnaccountableFillStyles` (which surfaces fill styles whose color
 * isn't covered by an existing variable-based palette).
 */
export function collectSolidFillStyles(parsed: ParsedFigma): SolidFillStyle[] {
  return Object.values(parsed.styles)
    .map((style) => {
      const color = pickFillStyleColor(style);

      return color ? { name: style.name, color, remote: style.remote } : null;
    })
    .filter((s): s is SolidFillStyle => s !== null);
}

/**
 * Surfaces FILL document styles whose underlying solid color isn't present
 * anywhere in the resolved palette (neither core nor semantic), split by
 * whether the style is defined locally in the source file or imported from
 * a linked library. Only meaningful when a variable-based palette was
 * produced — when the fallback path runs, the same fills become the palette
 * itself, so nothing is unaccounted for.
 */
export function resolveUnaccountableFillStyles(
  parsed: ParsedFigma,
  palette: ResolvedPalette,
): UnaccountableFillStyles {
  const accountedRgbas = new Set<string>();
  const local: string[] = [];
  const remote: string[] = [];

  palette.core.forEach(({ value }) => accountedRgbas.add(value));
  palette.semanticByValue.forEach((_, rgba) => accountedRgbas.add(rgba));

  collectSolidFillStyles(parsed).forEach(
    ({ name, color, remote: isRemote }) => {
      if (accountedRgbas.has(formatRgba(color))) return;

      (isRemote ? remote : local).push(name);
    },
  );

  return { local, remote };
}
