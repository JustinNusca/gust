import type { ParsedFigma } from "#action/parse-figma-response";
import type { ParsedFigmaStyle } from "#action/parse-figma-styles";
import type { ResolvedDomain } from "#util/resolved";

export interface FontEntry {
  family: string;
  weight: number;
  italic: boolean;
  postScriptName: string;
}

export interface ResolvedFonts extends ResolvedDomain {
  entries: FontEntry[];
}

/**
 * Reads the font-face fields off a TEXT style's resolved `style` object. The
 * REST API delivers these as concrete literals even when the source values are
 * bound to variables, so no alias traversal is needed here. Returns `null`
 * when the style isn't a TEXT style or its node lacked any of the required
 * fields — `fontPostScriptName` is required because it's the canonical
 * per-face identifier we use as the filename basis.
 */
function pickFontStyle(style: ParsedFigmaStyle): FontEntry | null {
  if (style.styleType !== "TEXT" || !style.textStyle) return null;
  const { fontFamily, fontWeight, fontPostScriptName, italic } =
    style.textStyle;
  if (!fontFamily || typeof fontWeight !== "number" || !fontPostScriptName) {
    return null;
  }
  return {
    family: fontFamily,
    weight: fontWeight,
    italic: italic === true,
    postScriptName: fontPostScriptName,
  };
}

/**
 * Resolves a `ParsedFigma` into the unique set of font faces referenced by
 * its TEXT styles, keyed by `postScriptName` so italic/condensed/etc. variants
 * that share a family and weight still produce separate `@font-face` entries.
 */
export function resolveFonts(parsed: ParsedFigma): ResolvedFonts {
  const entries: FontEntry[] = [];
  const seen = new Set<string>();

  for (const style of Object.values(parsed.styles)) {
    const font = pickFontStyle(style);
    if (!font) continue;
    if (seen.has(font.postScriptName)) continue;
    seen.add(font.postScriptName);
    entries.push(font);
  }

  return { isEmpty: entries.length === 0, entries };
}
