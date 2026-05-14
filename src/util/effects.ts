import type {
  BlurEffect,
  DropShadowEffect,
  Effect,
  InnerShadowEffect,
} from "@figma/rest-api-spec";

import type { ParsedFigma } from "#action/parse-figma-response";
import type { ParsedFigmaStyle } from "#action/parse-figma-styles";
import { formatRgba } from "#util/color-format";
import {
  BLUR_NAME_FRAGMENT_PATTERN,
  SHADOW_NAME_FRAGMENT_PATTERN,
  SHADOW_NAME_PATTERN,
} from "#util/name-patterns";
import { stripNameFragments } from "#util/names";
import type { ResolvedPalette } from "#util/palette";
import type { ResolvedDomain } from "#util/resolved";

export interface ShadowEntry {
  name: string;
  value: string;
}

export interface BlurStyle {
  /** Raw Figma style name; sanitized + stripped at write time. */
  name: string;
  /** Blur radius in pixels (matches Figma's `radius` field directly). */
  radius: number;
}

/**
 * Style names skipped during resolution because they have no clean CSS
 * equivalent (or, for `remote`, are unintentional library leakage). Each
 * list is surfaced by `writeCss` as a distinct warning so the dev knows
 * which Figma styles need manual implementation or cleanup.
 */
export interface ResolvedEffectsWarnings {
  /** Blur effects using Figma's progressive (spatial gradient) blur type. */
  progressiveBlur: string[];
  /** EFFECT styles carrying a `NOISE` effect. */
  noise: string[];
  /** EFFECT styles carrying a `TEXTURE` effect. */
  texture: string[];
  /** EFFECT styles carrying a `GLASS` effect. */
  glass: string[];
  /** EFFECT styles imported from a linked library (`remote: true`). */
  remote: string[];
}

export interface ResolvedEffects extends ResolvedDomain {
  /**
   * Entries emitted into a shared `@theme` block. Shadows become
   * `--shadow-*` tokens; layer blurs become `--blur-*` tokens (consumed by
   * Tailwind's `filter: blur(...)` utilities).
   */
  themed: {
    shadows: ShadowEntry[];
    layerBlurs: BlurStyle[];
  };
  /**
   * Entries emitted as standalone `@utility` blocks. Background blurs
   * become `backdrop-blur-{name}` utilities (a CSS `backdrop-filter`
   * doesn't fit Tailwind's `--blur-*` namespace, so we hand-roll the
   * utility instead).
   */
  utilities: {
    backgroundBlurs: BlurStyle[];
  };
  warnings: ResolvedEffectsWarnings;
}

type ShadowEffect = DropShadowEffect | InnerShadowEffect;

const isShadowEffect = (effect: Effect): effect is ShadowEffect =>
  effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW";

/**
 * Checks if a parsed style looks like a shadow token. To determine this,
 * we check that the style is an effect style, that its name contains a
 * "shadow/elevation-ish" word, and that it carries at least one `DROP_SHADOW`
 * effect.
 */
function isShadowStyle(style: ParsedFigmaStyle): boolean {
  if (style.styleType !== "EFFECT") return false;
  if (!SHADOW_NAME_PATTERN.test(style.name)) return false;
  return style.effects.some((effect) => effect.type === "DROP_SHADOW");
}

interface PaletteColorLookup {
  /**
   * Semantic palette entries whose sanitized name contains a shadow-ish word.
   * Keyed by underlying `rgba(...)` string; values are the sanitized token
   * names. Preferred over `core` when both contain the same color.
   */
  shadowSemantic: Map<string, string>;
  core: Map<string, string>;
}

/**
 * Builds the palette lookups consulted by `formatShadowEffect`. The shadow
 * resolver prefers a shadow-named semantic token over a raw core reference,
 * so callers can keep shadow colors tied to the same semantic that any
 * matching component would use; core is the fallback when no such semantic
 * exists.
 */
function buildPaletteColorLookup(
  palette: ResolvedPalette | undefined,
): PaletteColorLookup {
  const shadowSemantic = new Map<string, string>();
  const core = new Map<string, string>();
  if (!palette) return { shadowSemantic, core };

  for (const [rgba, names] of palette.semanticByValue) {
    const match = names.find((name) => SHADOW_NAME_PATTERN.test(name));
    if (match) shadowSemantic.set(rgba, match);
  }
  for (const { name, value } of palette.core) {
    if (!core.has(value)) core.set(value, name);
  }
  return { shadowSemantic, core };
}

/**
 * Serializes a single shadow effect into a CSS `box-shadow` segment of the
 * form `[inset] <x>px <y>px <blur>px <spread>px <color>`. Color precedence:
 *   1. `var(--color-{name})` when the rgba matches a shadow-named semantic
 *      palette entry.
 *   2. `var(--core-{name})` when the rgba matches a core palette entry.
 *   3. The raw `rgba(...)` literal.
 */
function formatShadowEffect(
  effect: ShadowEffect,
  lookup: PaletteColorLookup,
): string {
  const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
  const spread = effect.spread ?? 0;
  const rgba = formatRgba(effect.color);
  const semanticName = lookup.shadowSemantic.get(rgba);
  const coreName = !semanticName ? lookup.core.get(rgba) : undefined;
  const color = semanticName
    ? `var(--color-${semanticName})`
    : coreName
      ? `var(--core-${coreName})`
      : rgba;
  return `${inset}${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px ${spread}px ${color}`;
}

/**
 * Reads the blur radius of the first visible, non-progressive blur effect of
 * the requested `type` on a parsed style. Returns `null` when none is present.
 * Progressive blurs have no clean CSS equivalent (they describe a spatial
 * gradient, not a single radius), so they're intentionally skipped.
 */
function pickBlurRadius(
  style: ParsedFigmaStyle,
  type: BlurEffect["type"],
): number | null {
  for (const effect of style.effects) {
    if (effect.type !== type) continue;
    if (effect.visible === false) continue;
    if (effect.blurType === "PROGRESSIVE") continue;
    return effect.radius;
  }
  return null;
}

/**
 * Resolves a `ParsedFigma` into a writer-ready effects set covering both
 * shadow- and blur-bearing EFFECT styles. Shadow-shaped styles are rendered
 * into comma-joined `box-shadow` values (with `var(--color-*)` / `var(--core-*)`
 * substitutions when the palette is provided). Blur effects are split by type:
 * `LAYER_BLUR` becomes a layer-blur radius (consumed by Tailwind's
 * `--blur-*` namespace for `filter: blur(...)`) and `BACKGROUND_BLUR` becomes
 * a backdrop-blur radius (emitted as an explicit `backdrop-blur-{name}`
 * utility). A single style can contribute to multiple buckets — shadows and
 * blurs aren't mutually exclusive on a Figma EFFECT style.
 */
export function resolveEffects(
  parsed: ParsedFigma,
  palette?: ResolvedPalette,
): ResolvedEffects {
  const lookup = buildPaletteColorLookup(palette);
  const shadows: ShadowEntry[] = [];
  const layerBlurs: BlurStyle[] = [];
  const backgroundBlurs: BlurStyle[] = [];
  const progressiveBlurStyleSet = new Set<string>();
  const noiseStyleSet = new Set<string>();
  const textureStyleSet = new Set<string>();
  const glassStyleSet = new Set<string>();
  const remoteEffectStyleSet = new Set<string>();

  for (const style of Object.values(parsed.styles)) {
    if (style.styleType !== "EFFECT") continue;

    if (style.remote) {
      remoteEffectStyleSet.add(style.name);
      continue;
    }

    if (isShadowStyle(style)) {
      const shadowEffects = style.effects.filter(isShadowEffect);
      if (shadowEffects.length > 0) {
        const value = shadowEffects
          .map((effect) => formatShadowEffect(effect, lookup))
          .join(", ");
        shadows.push({ name: style.name, value });
      }
    }

    for (const effect of style.effects) {
      if (effect.visible === false) continue;
      if (
        (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") &&
        effect.blurType === "PROGRESSIVE"
      ) {
        progressiveBlurStyleSet.add(style.name);
      } else if (effect.type === "NOISE") {
        noiseStyleSet.add(style.name);
      } else if (effect.type === "TEXTURE") {
        textureStyleSet.add(style.name);
      } else if ((effect.type as string) === "GLASS") {
        glassStyleSet.add(style.name);
      }
    }

    const layerRadius = pickBlurRadius(style, "LAYER_BLUR");
    if (layerRadius !== null) {
      layerBlurs.push({ name: style.name, radius: layerRadius });
    }

    const backgroundRadius = pickBlurRadius(style, "BACKGROUND_BLUR");
    if (backgroundRadius !== null) {
      backgroundBlurs.push({ name: style.name, radius: backgroundRadius });
    }
  }

  return {
    isEmpty:
      shadows.length === 0 &&
      layerBlurs.length === 0 &&
      backgroundBlurs.length === 0,
    themed: { shadows, layerBlurs },
    utilities: { backgroundBlurs },
    warnings: {
      progressiveBlur: [...progressiveBlurStyleSet],
      noise: [...noiseStyleSet],
      texture: [...textureStyleSet],
      glass: [...glassStyleSet],
      remote: [...remoteEffectStyleSet],
    },
  };
}

/**
 * Strips shadow-domain fragments (`drop`, `shadow`, `dropshadow`, `elevation`)
 * from a sanitized token name so that source names like `modal-dropshadow`
 * collapse to `modal` before being prefixed with `shadow-` in the CSS output.
 */
export function stripShadowNameFragments(name: string): string {
  return stripNameFragments(name, SHADOW_NAME_FRAGMENT_PATTERN);
}

/**
 * Strips blur-domain fragments (`blur`, `filter`, `backdrop`, `background`,
 * `layer`, `effect`) from a sanitized token name so that source names like
 * `background-blur-modal` collapse to `modal` before being prefixed with
 * `--blur-` or `backdrop-blur-` in the CSS output.
 */
export function stripBlurNameFragments(name: string): string {
  return stripNameFragments(name, BLUR_NAME_FRAGMENT_PATTERN);
}
