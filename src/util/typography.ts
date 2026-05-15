import type { TypeStyle } from "@figma/rest-api-spec";

import type { ParsedFigma } from "#action/parse-figma-response";
import type { ParsedFigmaStyle } from "#action/parse-figma-styles";
import { TYPOGRAPHY_NAME_FRAGMENT_PATTERN } from "#util/name-patterns";
import { sanitizeName, stripNameFragments } from "#util/names";
import type { ResolvedDomain } from "#util/resolved";

const PX_PER_REM = 16;

export type TextTransform = "uppercase" | "lowercase" | "capitalize";
export type TextDecoration = "underline" | "line-through";
export type FontVariantCaps = "small-caps" | "all-small-caps";

export interface TypographyEntry {
  name: string;
  fontFamily?: string;
  fontSize?: string;
  letterSpacing?: string;
  lineHeight?: string;
  fontWeight?: number;
  italic: boolean;
  textTransform?: TextTransform;
  textDecoration?: TextDecoration;
  fontVariantCaps?: FontVariantCaps;
}

export interface FontFamilyDefinition {
  name: string;
  value: string;
}

export interface ResolvedTypography extends ResolvedDomain {
  entries: TypographyEntry[];
  fontFamilies: FontFamilyDefinition[];
}

/**
 * Formats a pixel measurement as a `rem` value at the 16px base, trimmed of
 * trailing zeros (e.g. `56` → `3.5rem`, `-1.12` → `-0.07rem`). `0` returns the
 * unitless `0` so it lands cleanly in any length context.
 */
function formatRem(px: number): string {
  if (px === 0) return "0";
  const rem = px / PX_PER_REM;
  const trimmed = Number.parseFloat(rem.toFixed(4)).toString();
  return `${trimmed}rem`;
}

function pickFontSize(textStyle: TypeStyle): string | undefined {
  if (typeof textStyle.fontSize !== "number" || textStyle.fontSize <= 0) {
    return undefined;
  }
  return formatRem(textStyle.fontSize);
}

function pickLetterSpacing(textStyle: TypeStyle): string | undefined {
  if (typeof textStyle.letterSpacing !== "number") return undefined;
  if (textStyle.letterSpacing === 0) return undefined;
  return formatRem(textStyle.letterSpacing);
}

/**
 * Reads the line-height field on a TEXT style. Returns a `rem` value for
 * `PIXELS` line heights and a unitless ratio for `FONT_SIZE_%` (the form
 * Tailwind's `--leading-*` namespace expects). `INTRINSIC_%` (browser default)
 * is skipped — there's no value worth emitting.
 */
function pickLineHeight(textStyle: TypeStyle): string | undefined {
  const unit = textStyle.lineHeightUnit;
  if (unit === "PIXELS" && typeof textStyle.lineHeightPx === "number") {
    return formatRem(textStyle.lineHeightPx);
  }
  if (
    unit === "FONT_SIZE_%" &&
    typeof textStyle.lineHeightPercentFontSize === "number"
  ) {
    const ratio = textStyle.lineHeightPercentFontSize / 100;
    return Number.parseFloat(ratio.toFixed(4)).toString();
  }
  return undefined;
}

/**
 * Picks a generic `font-family` fallback to append to the named family, based
 * on simple cues in the family name. Defaults to `sans-serif`.
 */
function inferGenericFallback(family: string): string {
  const lower = family.toLowerCase();
  if (/serif/.test(lower) && !/sans/.test(lower)) return "serif";
  if (/mono|code|courier|consolas/.test(lower)) return "monospace";
  return "sans-serif";
}

/**
 * Maps Figma's `textCase` to the matching CSS `text-transform` keyword. The
 * small-caps cases aren't `text-transform` values (CSS expresses them through
 * `font-variant-caps`), so they're left unset.
 */
function pickTextTransform(textStyle: TypeStyle): TextTransform | undefined {
  switch (textStyle.textCase) {
    case "UPPER":
      return "uppercase";
    case "LOWER":
      return "lowercase";
    case "TITLE":
      return "capitalize";
    default:
      return undefined;
  }
}

function pickTextDecoration(textStyle: TypeStyle): TextDecoration | undefined {
  switch (textStyle.textDecoration) {
    case "UNDERLINE":
      return "underline";
    case "STRIKETHROUGH":
      return "line-through";
    default:
      return undefined;
  }
}

/**
 * Maps Figma's small-caps `textCase` values to the matching CSS
 * `font-variant-caps` keyword. `SMALL_CAPS` only affects lowercase letters
 * (`small-caps`); `SMALL_CAPS_FORCED` also small-caps the uppercase letters
 * (`all-small-caps`). All other `textCase` values yield `undefined` — they are
 * handled by `pickTextTransform` instead.
 */
function pickFontVariantCaps(
  textStyle: TypeStyle,
): FontVariantCaps | undefined {
  switch (textStyle.textCase) {
    case "SMALL_CAPS":
      return "small-caps";
    case "SMALL_CAPS_FORCED":
      return "all-small-caps";
    default:
      return undefined;
  }
}

const isTextStyle = (
  style: ParsedFigmaStyle,
): style is ParsedFigmaStyle & { textStyle: TypeStyle } =>
  style.styleType === "TEXT" && style.textStyle !== undefined;

/**
 * Resolves a `ParsedFigma` into a writer-ready typography set. Filters styles
 * to TEXT styles, then extracts each style's font-size, letter-spacing,
 * line-height, font-weight, italic flag, and a sanitized font-family token.
 * Font families are deduplicated across all styles into a single shared list
 * so styles that share a face emit one `--font-{name}` variable.
 */
export function resolveTypography(parsed: ParsedFigma): ResolvedTypography {
  const entries: TypographyEntry[] = [];
  const fontFamilies = new Map<string, string>();

  for (const style of Object.values(parsed.styles)) {
    if (!isTextStyle(style)) continue;
    const textStyle = style.textStyle;

    let fontFamilyName: string | undefined;
    if (textStyle.fontFamily) {
      fontFamilyName = sanitizeName(textStyle.fontFamily);
      if (fontFamilyName !== "" && !fontFamilies.has(fontFamilyName)) {
        const fallback = inferGenericFallback(textStyle.fontFamily);
        fontFamilies.set(
          fontFamilyName,
          `'${textStyle.fontFamily}', ${fallback}`,
        );
      }
    }

    entries.push({
      name: style.name,
      fontFamily: fontFamilyName,
      fontSize: pickFontSize(textStyle),
      letterSpacing: pickLetterSpacing(textStyle),
      lineHeight: pickLineHeight(textStyle),
      fontWeight:
        typeof textStyle.fontWeight === "number"
          ? textStyle.fontWeight
          : undefined,
      italic: textStyle.italic === true,
      textTransform: pickTextTransform(textStyle),
      textDecoration: pickTextDecoration(textStyle),
      fontVariantCaps: pickFontVariantCaps(textStyle),
    });
  }

  return {
    isEmpty: entries.length === 0,
    entries,
    fontFamilies: [...fontFamilies.entries()].map(([name, value]) => ({
      name,
      value,
    })),
  };
}

/**
 * Strips typography-domain fragments (`typography`, `text`, `type`, `font`)
 * from a sanitized token name so that source names like `text-heading-1`
 * collapse to `heading-1` before being prefixed with `text-size-`, `tracking-`,
 * etc. in the CSS output.
 */
export function stripTypographyNameFragments(name: string): string {
  return stripNameFragments(name, TYPOGRAPHY_NAME_FRAGMENT_PATTERN);
}
