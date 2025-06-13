import { Tokens } from "../types";
import { flattenTokens, pxToRem, sanitizeName } from "../util";

export function generateGridCss(tokens: Tokens): string {
  const flattenedTokens = flattenTokens(tokens || {});
  const tokenKeys = Object.keys(flattenedTokens);

  // Map grid tokens to CSS string of variables for Tailwind theme block.
  const cssVariables = tokenKeys
    .map((key) => {
      const { value, type } = flattenedTokens[key];

      if (type !== "custom-grid") {
        return "";
      }

      let css = "";

      if (value.count !== undefined) {
        const sanitizedKey = sanitizeName(`grid-${key}-columns`);
        css += `  --${sanitizedKey}: ${value.count};\n`;
      }

      if (value.gutterSize !== undefined) {
        const sanitizedKey = sanitizeName(`spacing-${key}`);
        css += `  --${sanitizedKey}: ${pxToRem(value.gutterSize)};\n`;
      }

      if (value.sectionSize !== undefined) {
        const sanitizedKey = sanitizeName(`grid-${key}-column`);
        css += `  --${sanitizedKey}: ${pxToRem(value.sectionSize)};\n`;
      }

      return css;
    })
    .sort()
    .join("");
  const themeBlock = "@theme {\n" + `${cssVariables}` + "}\n";

  // Map grid tokens to CSS string of Tailwind utility declarations for grid layouts.
  const utilityClasses = tokenKeys
    .map((key, i) => {
      const { type, value } = flattenedTokens[key];

      if (type !== "custom-grid") {
        return "";
      }

      const isLast = i === tokenKeys.length - 1;
      const utilityName = sanitizeName(key);
      const hasExplicitColumnWidth = value.sectionSize !== undefined;
      const columnWidth = hasExplicitColumnWidth
        ? `var(--${sanitizeName(`grid-${utilityName}-column`)})`
        : "minmax(0, 1fr)";

      let utilityCss = `@utility ${utilityName} {\n  @apply grid min-h-0 gap-${sanitizeName(`${utilityName}`)} ${hasExplicitColumnWidth ? "w-max mx-auto" : ""};\n`;

      if (value.count !== undefined) {
        utilityCss += `  grid-template-columns: repeat(var(--${sanitizeName(`grid-${utilityName}-columns`)}), ${columnWidth});\n`;
      }
      utilityCss += `}\n${isLast ? "" : "\n"}`;

      return utilityCss;
    })
    .join("");

  return `${themeBlock}${utilityClasses ? "\n" : ""}${utilityClasses}`;
}
