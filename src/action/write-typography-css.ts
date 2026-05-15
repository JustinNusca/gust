import { join, resolve } from "path";

import { writeCssFile } from "#action/write-css-file";
import { formatCssBlock } from "#util/css-format";
import { withUniqueCssNames } from "#util/names";
import {
  type ResolvedTypography,
  stripTypographyNameFragments,
  type TypographyEntry,
} from "#util/typography";

const FONT_WEIGHT_NAMES: Record<number, string> = {
  100: "thin",
  200: "extralight",
  300: "light",
  400: "normal",
  500: "medium",
  600: "semibold",
  700: "bold",
  800: "extrabold",
  900: "black",
};

const WEIGHT_SUFFIX_TOKENS = new Set([
  "thin",
  "hairline",
  "extralight",
  "ultralight",
  "light",
  "regular",
  "normal",
  "book",
  "medium",
  "semibold",
  "demibold",
  "bold",
  "extrabold",
  "ultrabold",
  "black",
  "heavy",
]);

type NamedEntry = TypographyEntry & { cssName: string };

interface CollapsedEntry extends NamedEntry {
  /**
   * `true` when this entry stands in for two or more source styles that share
   * every typography property except `fontWeight`. Collapsed entries drop the
   * `font-{weight}` from the emitted `@apply` so callers can pick their own
   * weight by combining utilities (e.g. `type-heading-h5 font-bold`).
   */
  collapsed: boolean;
}

/**
 * Splits a sanitized `cssName` into its weight-agnostic base. Only the trailing
 * segment is consulted, so `heading-h5-bold` collapses to `heading-h5` but
 * `bold-callout` is left alone. Single-segment names are returned unchanged so
 * a style literally named `bold` doesn't collapse to an empty base.
 */
function weightAgnosticBase(cssName: string): string {
  const parts = cssName.split("-");
  if (parts.length > 1 && WEIGHT_SUFFIX_TOKENS.has(parts[parts.length - 1])) {
    return parts.slice(0, -1).join("-");
  }
  return cssName;
}

/**
 * Groups entries that share a weight-agnostic base name and every non-weight
 * typography property (font-family, font-size, letter-spacing, line-height,
 * italic). Groups with more than one member collapse to a single entry under
 * the shared base; singletons keep their full `cssName` and weight. The first
 * member's source order is preserved so the resulting list stays stable
 * relative to the Figma input.
 */
function collapseEntries(named: NamedEntry[]): CollapsedEntry[] {
  const groups = new Map<string, NamedEntry[]>();
  const groupOrder: string[] = [];

  for (const entry of named) {
    const base = weightAgnosticBase(entry.cssName);
    const key = JSON.stringify([
      base,
      entry.fontFamily ?? "",
      entry.fontSize ?? "",
      entry.letterSpacing ?? "",
      entry.lineHeight ?? "",
      entry.italic,
      entry.textTransform ?? "",
      entry.textDecoration ?? "",
      entry.fontVariantCaps ?? "",
    ]);
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
      groupOrder.push(key);
    }
  }

  const collapsed: CollapsedEntry[] = [];
  const emittedNames = new Set<string>();

  for (const key of groupOrder) {
    const members = groups.get(key) ?? [];
    const first = members[0];
    if (members.length > 1) {
      const base = weightAgnosticBase(first.cssName);
      if (base === "" || emittedNames.has(base)) continue;
      emittedNames.add(base);
      collapsed.push({ ...first, cssName: base, collapsed: true });
    } else {
      if (emittedNames.has(first.cssName)) continue;
      emittedNames.add(first.cssName);
      collapsed.push({ ...first, collapsed: false });
    }
  }

  return collapsed;
}

function buildThemeBlock(
  typography: ResolvedTypography,
  entries: CollapsedEntry[],
): string {
  const familyLines = typography.fontFamilies.map(
    ({ name, value }) => `  --font-${name}: ${value};`,
  );
  const sizeLines: string[] = [];
  const trackingLines: string[] = [];
  const leadingLines: string[] = [];

  for (const entry of entries) {
    if (entry.lineHeight) {
      leadingLines.push(`  --leading-${entry.cssName}: ${entry.lineHeight};`);
    }

    if (entry.fontSize) {
      sizeLines.push(`  --text-size-${entry.cssName}: ${entry.fontSize};`);
    }

    if (entry.letterSpacing) {
      trackingLines.push(
        `  --tracking-${entry.cssName}: ${entry.letterSpacing};`,
      );
    }
  }

  const sections = [familyLines, leadingLines, sizeLines, trackingLines]
    .map((lines) => [...lines].sort())
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.join("\n"));

  return formatCssBlock("@theme", [sections.join("\n\n")]);
}

function buildUtility(entry: CollapsedEntry): string | null {
  const applies: string[] = [];
  if (entry.letterSpacing) applies.push(`tracking-${entry.cssName}`);
  if (entry.fontSize) applies.push(`text-size-${entry.cssName}`);
  if (entry.fontFamily) applies.push(`font-${entry.fontFamily}`);
  if (!entry.collapsed && entry.fontWeight !== undefined) {
    const weightName = FONT_WEIGHT_NAMES[entry.fontWeight];
    if (weightName) applies.push(`font-${weightName}`);
  }
  if (entry.lineHeight) applies.push(`leading-${entry.cssName}`);
  if (entry.italic) applies.push("italic");
  if (entry.textTransform) applies.push(entry.textTransform);
  if (entry.textDecoration) applies.push(entry.textDecoration);

  if (applies.length === 0 && !entry.fontVariantCaps) return null;

  const lines: string[] = [];
  if (applies.length > 0) lines.push(`  @apply ${applies.join(" ")};`);
  if (entry.fontVariantCaps) {
    lines.push(`  font-variant-caps: ${entry.fontVariantCaps};`);
  }

  return formatCssBlock("@utility", lines, `type-${entry.cssName}`);
}

function buildTypographyCss(typography: ResolvedTypography): string {
  const entries = collapseEntries(
    withUniqueCssNames(typography.entries, stripTypographyNameFragments),
  ).sort((a, b) => a.cssName.localeCompare(b.cssName));
  const blocks: string[] = [buildThemeBlock(typography, entries)];

  for (const entry of entries) {
    const utility = buildUtility(entry);
    if (utility) blocks.push(utility);
  }

  return `${blocks.join("\n\n")}\n`;
}

export async function writeTypographyCss(
  typography: ResolvedTypography,
  outputDir: string,
): Promise<string> {
  const filePath = join(resolve(outputDir), "theme", "typography.css");
  return writeCssFile(filePath, buildTypographyCss(typography), "Typography");
}
