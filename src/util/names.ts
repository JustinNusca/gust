/**
 * Given a kabob-cased name, deduplicates repeated parts (e.g. "color-color-foo"
 * becomes "color-foo").
 */
export function deduplicateName(name: string): string {
  const parts = name.split("-");

  return parts
    .reduce(
      (acc, part) => (!acc.includes(part) ? [...acc, part] : acc),
      [] as string[],
    )
    .join("-");
}

/**
 * Given a token name, sanitizes it by:
 * - Stripping accents and diacritics.
 * - Kebab-casing names.
 * - Replacing "synonyms" for 'color' with 'color'.
 * - De-pluralizing commonly used "theme" words.
 * - Removing non-alphanumeric characters (except for hyphens).
 * - Collapsing repeated hyphens into a single instance.
 */
export function sanitizeName(name: string) {
  return deduplicateName(
    name
      // Remove accents and diacritics
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Add hyphen before uppercase letters.
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      // Replace "synonyms" for 'color' with 'color'.
      // This removes differences in spelling and helps keep names shorter.
      .replace(/(colour|palette)/gi, "color")
      // Remove the 's' from the end of commonly used "theme" words.
      // This removes unnecessary plurals and helps keep names shorter.
      .replace(
        /\b(color|gradient|token|font|border|shadow|spacing|size|background|text|surface|neutral|accent)s\b/gi,
        "$1",
      )
      // Replace non-alphanumeric characters with hyphen.
      .replace(/[^a-zA-Z0-9]/g, "-")
      // Replace repeated hyphens with a single instance.
      .replace(/-+/g, "-")
      // Remove leading or trailing hyphens.
      .replace(/(-+)$|^(-+)/g, "")
      .toLocaleLowerCase(),
  );
}

/**
 * Drops kebab-case fragments whose value matches `pattern` from `name`. Used
 * by each domain resolver to strip its own domain words (e.g. `radius`,
 * `shadow`, `gradient`) so that source names like `corner-radius-xs` collapse
 * to `xs` before being re-prefixed during CSS emission.
 */
export function stripNameFragments(name: string, pattern: RegExp): string {
  return name
    .split("-")
    .filter((part) => !pattern.test(part))
    .join("-");
}

/**
 * Annotates each entry with a CSS-safe `cssName` derived by piping `entry.name`
 * through `sanitizeName` and then `stripFragments`. Drops entries whose derived
 * name is empty or has already been used by an earlier entry, so the result is
 * guaranteed unique by `cssName`. Source order is preserved.
 */
export function withUniqueCssNames<T extends { name: string }>(
  entries: T[],
  stripFragments: (name: string) => string,
): (T & { cssName: string })[] {
  const seen = new Set<string>();
  const result: (T & { cssName: string })[] = [];
  for (const entry of entries) {
    const cssName = stripFragments(sanitizeName(entry.name));
    if (cssName === "" || seen.has(cssName)) continue;
    seen.add(cssName);
    result.push({ ...entry, cssName });
  }
  return result;
}

/**
 * Formats a sanitized name as a CSS variable reference, with an optional prefix.
 * For example, with the name "primary" and prefix "color", this returns
 * "var(--color-primary)". With the name "radius-sm" and no prefix, this returns
 * "var(--radius-sm)".
 */
export function getCssVariableName(name: string, prefix = ""): string {
  return `var(--${sanitizeName(`${prefix}${prefix ? "-" : ""}${name}`)})`;
}
