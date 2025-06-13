import { FontToken, Tokens } from "../types";
import { flattenTokens, pxToRem, sanitizeName } from "../util";

export function generateFontCss(tokens: Tokens): string {
  const fontTokens = flattenTokens(tokens.font || {}) as Record<
    string,
    FontToken
  >;

  // Create list of font faces that are unique by family and weight.
  // TODO: Handle unique files for font styles (eg. italic, bold) — these are
  // generally not defined as unique tokens in Figma, but are needed for proper
  // font rendering of these different styles.
  const fontFaces = new Set<string>();

  Object.keys(fontTokens).forEach((key) => {
    const value = fontTokens[key].value;
    fontFaces.add(`${value.fontFamily}|${value.fontWeight}`);
  });

  const sortedFaces = Array.from(fontFaces).sort();

  // Map sorted font faces to CSS string of @font-face rules.
  return sortedFaces
    .map((face, i) => {
      const isLast = i === sortedFaces.length - 1;
      const [fontFamily, fontWeight] = face.split("|");
      const sanitizedFamily = sanitizeName(fontFamily);
      const placeholderUrl = `../assets/font/${sanitizedFamily}-${fontWeight}.woff2`;

      return (
        "@font-face {\n" +
        `  font-family: "${fontFamily}";\n` +
        `  src: url("${placeholderUrl}") format("woff2");\n` +
        `  font-weight: ${fontWeight};\n` +
        `}\n${isLast ? "" : "\n"}`
      );
    })
    .join("");
}

export function generateTypographyCss(tokens: Tokens): string {
  const fontTokens = flattenTokens(tokens.font || {}) as Record<
    string,
    FontToken
  >;

  // Create list of CSS variables for each variant's style properties.
  const themeVariables = new Map<string, string>();
  const fontTokenKeys = Object.keys(fontTokens);

  Object.keys(fontTokens).forEach((key) => {
    const { value } = fontTokens[key];
    const sanitizedKey = sanitizeName(key);

    themeVariables.set(
      `--font-${sanitizeName(value.fontFamily)}`,
      `"${value.fontFamily}"`,
    );
    themeVariables.set(
      `--font-weight-${value.fontWeight}`,
      value.fontWeight.toString(),
    );
    themeVariables.set(`--leading-${sanitizedKey}`, pxToRem(value.lineHeight));
    themeVariables.set(`--text-size-${sanitizedKey}`, pxToRem(value.fontSize));
    themeVariables.set(
      `--tracking-${sanitizedKey}`,
      pxToRem(value.letterSpacing),
    );
  });

  const sortedVariables = Array.from(themeVariables.keys()).sort();

  // Map variables to CSS string for Tailwind theme block.
  const themeBlock =
    "@theme {\n" +
    sortedVariables
      .map((key) => `  ${key}: ${themeVariables.get(key)};\n`)
      .join("") +
    "}\n\n";

  // Map tokens to CSS string of Tailwind utility declarations for each variant.
  const utilityClasses = fontTokenKeys
    .map((key, i) => {
      const isLast = i === fontTokenKeys.length - 1;
      const { value } = fontTokens[key];

      const sanitizedKey = sanitizeName(key);
      const utilityName = `font-${sanitizedKey}`;
      const applyClasses = [
        `font-${sanitizeName(value.fontFamily)}`,
        `font-weight-${value.fontWeight}`,
        `leading-${sanitizedKey}`,
        `text-size-${sanitizedKey}`,
        `tracking-${sanitizedKey}`,
        value.textCase === "uppercase" ? "uppercase" : undefined,
      ]
        .filter(Boolean)
        .join(" ");

      return (
        `@utility ${utilityName} {\n` +
        `  @apply ${applyClasses};\n` +
        `}\n${isLast ? "" : "\n"}`
      );
    })
    .join("");

  return `${themeBlock}${utilityClasses}`;
}
