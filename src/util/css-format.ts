/**
 * Wraps `lines` in a CSS at-rule block of the form `${kind} ${name?} { ... }`.
 * Lines are joined with newlines and emitted verbatim — callers are responsible
 * for their own indentation. Used by every writer that emits `@theme`,
 * `@utility`, or `@font-face` blocks.
 */
export function formatCssBlock(
  kind: string,
  lines: string[],
  name?: string,
): string {
  const header = name ? `${kind} ${name}` : kind;
  return `${header} {\n${lines.join("\n")}\n}`;
}
