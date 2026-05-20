import { formatCssBlock } from "#util/css-format";
import type { TokenEntry, TokenMode } from "#util/resolved";

const DEFAULT_NON_SEMANTIC_FLAG = (value: string): boolean =>
  value.includes("rgba(") || value.includes("var(--core-");

export interface BuildDomainBlocksOptions<E extends TokenEntry> {
  core: E[];
  modes: TokenMode<E>[];
  /** Used in `--{prefix}-*: initial;` and `--{prefix}-{name}: …;`. */
  prefix: string;
  /**
   * Transforms an entry's `name` into the CSS identifier segment. Returning
   * an empty string drops the entry. Defaults to identity.
   */
  cssName?: (name: string) => string;
  /**
   * Additional drop predicate applied to the post-`cssName` identifier.
   * Returning `true` skips that entry — handy for elision of names that
   * collide with hard-coded statics (e.g. radii's `none`/`full`).
   */
  skipCssName?: (cssName: string) => boolean;
  /** Lines inserted between the default mode's reset and its entry lines. */
  prependDefault?: string[];
  /** Lines appended to the default mode's block after its entry lines. */
  appendDefault?: string[];
}

/**
 * Builds the shared "core block + per-mode @theme blocks" structure used by
 * the palette and radii writers. Emits `@layer base { :root { --core-…; … } }`
 * when `core` has entries; then iterates `modes`, emitting `@theme {name}? { … }`
 * for each — special-casing `isDefault` to prepend the `--{prefix}-*: initial;`
 * reset and any caller-provided static lines. Non-default modes with no
 * surviving entries are skipped entirely.
 */
export function buildDomainBlocks<E extends TokenEntry>(
  opts: BuildDomainBlocksOptions<E>,
): string[] {
  const transform = opts.cssName ?? ((name) => name);
  const blocks: string[] = [];

  if (opts.core.length > 0) {
    const lines = opts.core.map(
      ({ name, value }) => `    --core-${name}: ${value};`,
    );
    blocks.push(`@layer base {\n  :root {\n${lines.join("\n")}\n  }\n}`);
  }

  for (const mode of opts.modes) {
    const entryLines = mode.entries
      .map(({ name, value }) => ({ cssName: transform(name), value }))
      .filter(({ cssName }) => cssName !== "" && !opts.skipCssName?.(cssName))
      .map(({ cssName, value }) => `  --${opts.prefix}-${cssName}: ${value};`);

    if (mode.isDefault) {
      blocks.push(
        formatCssBlock("@theme", [
          `  --${opts.prefix}-*: initial;`,
          ...(opts.prependDefault ?? []),
          ...entryLines,
          ...(opts.appendDefault ?? []),
        ]),
      );
      continue;
    }
    if (entryLines.length === 0) continue;
    blocks.push(formatCssBlock("@theme", entryLines, mode.name));
  }

  return blocks;
}

export interface ThemeLines {
  /**
   * `--{prefix}-*: initial;` reset, or `null` when there are no entries to
   * emit. Callers combine multiple sections' resets at the top of a shared
   * `@theme` block.
   */
  resetLine: string | null;
  tokenLines: string[];
}

/**
 * Formats a flat (mode-less) list of pre-annotated entries into the line
 * fragments of a `@theme` block: an optional `--{prefix}-*: initial;` reset
 * plus one `--{prefix}-{cssName}: {value};` line per entry. Returns the
 * fragments rather than a wrapped block so callers can compose multiple
 * sections (e.g. effects shadows + layer blurs) into a single `@theme`.
 *
 * Entries are expected to already carry a unique `cssName` (e.g. from
 * `withUniqueCssNames`); no dedup is performed here.
 */
export function buildThemeLines<E extends { cssName: string }>(opts: {
  entries: E[];
  prefix: string;
  valueFor: (entry: E) => string;
}): ThemeLines {
  const tokenLines = opts.entries.map(
    (entry) => `  --${opts.prefix}-${entry.cssName}: ${opts.valueFor(entry)};`,
  );
  return {
    resetLine: tokenLines.length > 0 ? `  --${opts.prefix}-*: initial;` : null,
    tokenLines,
  };
}

/**
 * Formats each entry as a `@utility {prefix}-{cssName} { …body }` block.
 * Used by domains that emit one utility per token (gradients, backdrop
 * blurs, grid layouts) rather than `@theme` token variables. Entries whose
 * `bodyFor` returns `null` are skipped — handy for grid, where an entry
 * may degenerate to just `@apply grid;` with no real layout to emit.
 */
export function buildUtilityBlocks<E extends { cssName: string }>(opts: {
  entries: E[];
  prefix: string;
  bodyFor: (entry: E) => string[] | null;
}): string[] {
  const blocks: string[] = [];
  for (const entry of opts.entries) {
    const body = opts.bodyFor(entry);
    if (!body) continue;
    blocks.push(
      formatCssBlock("@utility", body, `${opts.prefix}-${entry.cssName}`),
    );
  }
  return blocks;
}

/**
 * Collects the prefixed CSS identifiers (e.g. `--shadow-modal`,
 * `bg-gradient-sunset`) of entries whose value still falls back to a raw
 * `rgba(...)` literal or a `var(--core-*)` reference — i.e. didn't resolve
 * to a semantic palette token. The default `flag` matches that pattern;
 * palette's narrower "raw rgba only" check can pass its own.
 *
 * Dedup is keyed by `nameFor` output so the same identifier won't appear
 * twice when iterated across multiple sections (e.g. palette walks default
 * + every non-default mode).
 */
export function collectFlaggedNames<E>(opts: {
  entries: E[];
  valueFor: (entry: E) => string;
  nameFor: (entry: E) => string;
  flag?: (value: string) => boolean;
}): string[] {
  const flag = opts.flag ?? DEFAULT_NON_SEMANTIC_FLAG;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of opts.entries) {
    if (!flag(opts.valueFor(entry))) continue;
    const name = opts.nameFor(entry);
    if (seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}
