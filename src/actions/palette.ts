import { GradientToken, PaletteToken, Tokens } from "../types";
import {
  flattenTokens,
  getCssVariableName,
  isTokenReference,
  sanitizeName,
} from "../util";

function getColorVariable(key: string, token: PaletteToken): string {
  const { value } = token as PaletteToken;
  const sanitizedKey = sanitizeName(`color-${key}`);
  const colorValue = isTokenReference(value)
    ? getCssVariableName(value, "color")
    : value;

  return `  --${sanitizedKey}: ${colorValue};\n`;
}

function getGradientVariable(key: string, token: GradientToken): string {
  const { value } = token as GradientToken;
  const sanitizedKey = sanitizeName(key);
  const gradientStops = value.stops
    .map((stop) => {
      const colorValue = isTokenReference(stop.color)
        ? getCssVariableName(stop.color, "color")
        : stop.color;
      return `${colorValue} ${stop.position * 100}%`;
    })
    .join(", ");
  const gradientCssValue = `linear-gradient(${Math.round(value.rotation)}deg, ${gradientStops})`;
  return `  --bg-${sanitizedKey}: ${gradientCssValue};\n`;
}

export function generatePaletteCss(tokens: Tokens): string {
  const flattenedTokens = flattenTokens(tokens || {});
  const tokenKeys = Object.keys(flattenedTokens);

  // Map tokens to CSS string of variables for Tailwind theme block.
  const cssVariables = tokenKeys
    .map((key) => {
      const token = flattenedTokens[key];

      switch (token.type) {
        case "color":
          return getColorVariable(key, token);
        case "custom-gradient":
          return getGradientVariable(key, token);
        default:
          return "";
      }
    })
    .join("");
  const themeBlock =
    "@theme {\n" + "  --color-*: initial;\n" + `${cssVariables}` + "}\n";

  // Map gradient tokens to CSS string of Tailwind utility declarations for backgrounds.
  const utilityClasses = tokenKeys
    .map((key, i) => {
      const token = flattenedTokens[key];

      if (token.type !== "custom-gradient") {
        return "";
      }

      const isLast = i === tokenKeys.length - 1;
      const sanitizedKey = sanitizeName(key);
      const utilityName = `bg-${sanitizedKey}`;

      return (
        `@utility ${utilityName} {\n` +
        `  background: ${getCssVariableName(key, "bg")};\n` +
        `}\n${isLast ? "" : "\n"}`
      );
    })
    .join("");

  return `${themeBlock}${utilityClasses ? "\n" : ""}${utilityClasses}`;
}
