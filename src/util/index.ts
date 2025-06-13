import { Token, Tokens } from "../types";

export function deduplicateName(name: string): string {
  const parts = name.split("-");

  return parts
    .reduce(
      (acc, part) => (!acc.includes(part) ? [...acc, part] : acc),
      [] as string[],
    )
    .join("-");
}

export function flattenTokens(tokens: Tokens, prefix = "") {
  const results = {} as Record<string, Token>;
  const tokenKeys = Object.keys(tokens);

  tokenKeys.forEach((key) => {
    const value = tokens[key] as Token;
    const fullPrefix = `${prefix}${prefix ? "-" : ""}${sanitizeName(key)}`;

    if (!value) {
      return;
    }

    // If the value is a Token object, add it directly to results, otherwise
    // recurse into it if it's an object that may contain nested tokens.
    if (typeof value.type === "string") {
      results[fullPrefix] = value;
    } else if (typeof value === "object") {
      Object.assign(results, flattenTokens(value, fullPrefix));
    }
  });

  return results;
}

export function isTokenReference(color: string) {
  return color.startsWith("{") && color.endsWith("}");
}

export function pxToRem(value: string | number, baseRem = 16): string {
  const floatValue = parseFloat(`${value}`);

  if (isNaN(floatValue)) {
    // If the value cannot be parsed as a number, return it as-is.
    return `${value}`;
  }

  return `${floatValue / baseRem}rem`;
}

export function sanitizeName(name: string) {
  return deduplicateName(
    name
      // Add hyphen before uppercase letters.
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      // Replace "synonyms" for 'color' with 'color'.
      // This removes differences in spelling and helps keep names shorter.
      .replace(/(colour|palette)/g, "color")
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
      .toLowerCase(),
  );
}

export function getCssVariableName(name: string, prefix = ""): string {
  return `var(--${sanitizeName(`${prefix}${prefix ? "-" : ""}${name}`)})`;
}
