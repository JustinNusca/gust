import type { RGB, RGBA } from "@figma/rest-api-spec";

const toByte = (channel: number) => Math.round(channel * 255);

/**
 * Formats an alpha channel for use inside `rgba(...)`. Integers (e.g. fully
 * opaque or fully transparent) render without decimals; fractional values are
 * rounded to two decimals with trailing zeros trimmed (e.g. `0.5`, not
 * `0.50`).
 */
export function formatAlpha(alpha: number): string {
  return Number.isInteger(alpha)
    ? alpha.toString()
    : alpha.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Serializes an `RGB`/`RGBA` color into a CSS `rgba(r,g,b,a)` string with
 * 0–255 channels. `RGB` values (no alpha) are treated as fully opaque.
 */
export function formatRgba(color: RGB | RGBA): string {
  const r = toByte(color.r);
  const g = toByte(color.g);
  const b = toByte(color.b);
  const a = "a" in color ? color.a : 1;
  return `rgba(${r},${g},${b},${formatAlpha(a)})`;
}
