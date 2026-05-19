/**
 * Common shape adopted by every `resolveX` output. Each resolver sets
 * `isEmpty` to `true` when its output has nothing to emit; the writer
 * orchestrator uses that flag to decide whether to skip the corresponding
 * CSS file. Each domain's notion of "empty" is bespoke (no entries, no
 * tokens across any mode, no usable shadow/blur effects) so the flag is
 * computed locally inside the resolver.
 */
export interface ResolvedDomain {
  isEmpty: boolean;
}

/**
 * A single token row emitted by a domain resolver — a sanitized CSS name
 * and a CSS-ready string value. Both palette colors and radii numbers
 * conform; future scalar domains (spacing, sizing) are expected to as well.
 */
export interface TokenEntry {
  name: string;
  value: string;
}

/**
 * One theme-mode bucket of token rows. The orchestrator always places the
 * default mode at index 0 (`isDefault: true`), even when its `entries`
 * array is empty — the writer still emits the default `@theme` block as
 * the `--prefix-*: initial;` reset baseline. Non-default modes are only
 * included when they contributed at least one entry.
 */
export interface TokenMode<E extends TokenEntry = TokenEntry> {
  name: string;
  isDefault: boolean;
  entries: E[];
}

/**
 * Core + modes envelope shared by `ResolvedPalette` and `ResolvedRadii`.
 * Domains extend it to add their own bespoke fields (e.g. palette's
 * `semanticByValue` lookup for downstream effects).
 */
export interface ResolvedTokenDomain<
  E extends TokenEntry = TokenEntry,
> extends ResolvedDomain {
  core: E[];
  modes: TokenMode<E>[];
}

/**
 * Reports whether a resolved domain has no tokens to emit. Just a typed
 * accessor over the `isEmpty` flag every `resolveX` writes — exists so the
 * orchestrator can ask the same question of every domain through one
 * import.
 */
export function isEmpty(resolved: ResolvedDomain): boolean {
  return resolved.isEmpty;
}
