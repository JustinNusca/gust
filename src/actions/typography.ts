import { FontToken } from "../types";
import { pxToRem, sanitizeName } from "../util";

export function generateFontCss(tokens: Record<string, FontToken>): string {
  // Create list of font faces that are unique by family and weight.
  // TODO: Handle unique files for font styles (eg. italic, bold) — these are
  // generally not defined as unique tokens in Figma, but are needed for proper
  // font rendering of these different styles.
  const fontFaces = new Set<string>();

  Object.keys(tokens).forEach((key) => {
    const value = tokens[key].value;
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

export function generateTypographyCss(
  tokens: Record<string, FontToken>,
): string {
  // Create list of CSS variables for each variant's style properties.
  const themeVariables = new Map<string, string>();
  const fontTokenKeys = Object.keys(tokens).sort();

  Object.keys(tokens).forEach((key) => {
    const { value } = tokens[key];
    const sanitizedKey = sanitizeName(key);
    const parsedLineHeight =
      (value.lineHeightPercentFontSize || 100) / 100 || 1;

    themeVariables.set(
      `--font-${sanitizeName(value.fontFamily || "unknown")}`,
      `"${value.fontFamily}"`,
    );
    themeVariables.set(
      `--font-weight-${value.fontWeight}`,
      value.fontWeight?.toString() || "400",
    );
    themeVariables.set(
      `--leading-${sanitizedKey}`,
      Number.isInteger(parsedLineHeight)
        ? `${parsedLineHeight}`
        : parsedLineHeight.toFixed(2),
    );
    themeVariables.set(
      `--text-size-${sanitizedKey}`,
      pxToRem(value.fontSize || 16),
    );
    themeVariables.set(
      `--tracking-${sanitizedKey}`,
      pxToRem(value.letterSpacing || "normal"),
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
      const { value } = tokens[key];

      const sanitizedKey = sanitizeName(key);
      const utilityName = `font-${sanitizedKey}`;
      const applyClasses = [
        `font-${sanitizeName(value.fontFamily || "unknown")}`,
        `font-weight-${value.fontWeight}`,
        `leading-${sanitizedKey}`,
        `text-size-${sanitizedKey}`,
        `tracking-${sanitizedKey}`,
        value.textCase === "UPPER" ? "uppercase" : undefined,
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
