import type { GradientPaint, Paint, RGBA, Vector } from "@figma/rest-api-spec";

import type { ParsedFigma } from "#action/parse-figma-response";
import type { ParsedFigmaStyle } from "#action/parse-figma-styles";
import { formatRgba } from "#util/color-format";
import {
  GRADIENT_NAME_FRAGMENT_PATTERN,
  GRADIENT_NAME_PATTERN,
} from "#util/name-patterns";
import { stripNameFragments } from "#util/names";
import type { ResolvedPalette } from "#util/palette";
import type { ResolvedDomain } from "#util/resolved";

export interface GradientEntry {
  name: string;
  value: string;
}

export interface ResolvedGradients extends ResolvedDomain {
  entries: GradientEntry[];
}

type GradientType = GradientPaint["type"];

const isGradientPaint = (paint: Paint): paint is GradientPaint =>
  paint.type === "GRADIENT_LINEAR" ||
  paint.type === "GRADIENT_RADIAL" ||
  paint.type === "GRADIENT_ANGULAR";

/**
 * Reports whether a parsed style is a FILL style carrying at least one
 * representable gradient paint. `GRADIENT_DIAMOND` has no CSS equivalent so it
 * doesn't count.
 */
function isGradientStyle(style: ParsedFigmaStyle): boolean {
  if (style.styleType !== "FILL") return false;
  return style.fills.some(
    (paint) => paint.visible !== false && isGradientPaint(paint),
  );
}

interface PaletteColorLookup {
  /**
   * Semantic palette entries whose name contains "gradient". Preferred over
   * `semantic` so gradient stops collapse to a gradient-named token when one
   * exists.
   */
  gradientSemantic: Map<string, string>;
  semantic: Map<string, string>;
  core: Map<string, string>;
}

/**
 * Builds the palette lookups consulted when serializing gradient stops.
 * Gradient stops use these lookups to swap from literal `rgba(...)` values to
 * CSS variable references when possible. Precedence: gradient-named semantic
 * → any other semantic → core token → raw rgba.
 */
function buildPaletteColorLookup(
  palette: ResolvedPalette | undefined,
): PaletteColorLookup {
  const gradientSemantic = new Map<string, string>();
  const semantic = new Map<string, string>();
  const core = new Map<string, string>();
  if (!palette) return { gradientSemantic, semantic, core };

  for (const [rgba, names] of palette.semanticByValue) {
    const gradientMatch = names.find((name) =>
      GRADIENT_NAME_PATTERN.test(name),
    );
    if (gradientMatch) gradientSemantic.set(rgba, gradientMatch);
    const otherMatch = names.find((name) => !GRADIENT_NAME_PATTERN.test(name));
    if (otherMatch) semantic.set(rgba, otherMatch);
  }
  for (const { name, value } of palette.core) {
    if (!core.has(value)) core.set(value, name);
  }
  return { gradientSemantic, semantic, core };
}

/**
 * Picks a CSS color reference for a gradient stop. Prefers a gradient-named
 * semantic token, then any other semantic token, then a core token, and
 * finally falls back to the raw rgba value. Matches must be exact, including
 * alpha, to be substituted.
 */
function formatStopColor(
  color: RGBA,
  paintOpacity: number,
  lookup: PaletteColorLookup,
): string {
  if (paintOpacity < 1) {
    return formatRgba({ ...color, a: color.a * paintOpacity });
  }
  const rgba = formatRgba(color);
  const gradientSemantic = lookup.gradientSemantic.get(rgba);
  if (gradientSemantic) return `var(--color-${gradientSemantic})`;
  const semantic = lookup.semantic.get(rgba);
  if (semantic) return `var(--color-${semantic})`;
  const core = lookup.core.get(rgba);
  if (core) return `var(--core-${core})`;
  return rgba;
}

/**
 * Formats a position along the gradient axis (0..1) as a CSS percentage,
 * rounded to two decimals with trailing zeros trimmed (e.g. `100%`, `33.33%`).
 */
const formatPercent = (position: number): string =>
  `${(position * 100).toFixed(2).replace(/\.?0+$/, "")}%`;

/**
 * Converts a Figma `GRADIENT_LINEAR` handle pair (in normalized object space,
 * y-down) into a CSS `<angle>` in degrees, where 0deg points up and angles
 * increase clockwise.
 */
function linearAngle(handles: Vector[]): number {
  const [start, end] = handles;
  if (!start || !end) return 180;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round(normalized * 100) / 100;
}

const formatStops = (
  paint: GradientPaint,
  lookup: PaletteColorLookup,
): string =>
  paint.gradientStops
    .map(
      (stop) =>
        `${formatStopColor(stop.color, paint.opacity ?? 1, lookup)} ${formatPercent(stop.position)}`,
    )
    .join(", ");

/**
 * Translates a single Figma `GradientPaint` into a CSS `background-image`
 * value. Returns `null` for paint types that have no clean CSS equivalent.
 */
function formatGradientPaint(
  paint: GradientPaint,
  lookup: PaletteColorLookup,
): string | null {
  const stops = formatStops(paint, lookup);
  const type: GradientType = paint.type;
  if (type === "GRADIENT_LINEAR") {
    return `linear-gradient(${linearAngle(paint.gradientHandlePositions)}deg, ${stops})`;
  }
  if (type === "GRADIENT_RADIAL") {
    return `radial-gradient(circle, ${stops})`;
  }
  if (type === "GRADIENT_ANGULAR") {
    return `conic-gradient(${stops})`;
  }
  return null;
}

/**
 * Resolves a `ParsedFigma` into a writer-ready gradient set. Filters styles
 * via `isGradientStyle`, then serializes every visible gradient paint on each
 * style and joins them with `, ` (CSS background-image accepts multiple
 * comma-separated layers). When a `palette` is provided, stop colors that
 * match a palette entry collapse to `var(--color-{name})` (semantic-first)
 * or `var(--core-{name})`.
 */
export function resolveGradients(
  parsed: ParsedFigma,
  palette?: ResolvedPalette,
): ResolvedGradients {
  const lookup = buildPaletteColorLookup(palette);
  const entries: GradientEntry[] = [];

  for (const style of Object.values(parsed.styles)) {
    if (!isGradientStyle(style)) continue;
    const parts: string[] = [];
    for (const paint of style.fills) {
      if (paint.visible === false) continue;
      if (!isGradientPaint(paint)) continue;
      const formatted = formatGradientPaint(paint, lookup);
      if (formatted) parts.push(formatted);
    }
    if (parts.length === 0) continue;
    entries.push({ name: style.name, value: parts.join(", ") });
  }

  return { isEmpty: entries.length === 0, entries };
}

/**
 * Strips gradient-domain fragments (`gradient`, `bg`, `background`) from a
 * sanitized token name so that source names like `gradient-dark` collapse to
 * `dark` before being prefixed with `bg-gradient-` in the CSS output.
 */
export function stripGradientNameFragments(name: string): string {
  return stripNameFragments(name, GRADIENT_NAME_FRAGMENT_PATTERN);
}
