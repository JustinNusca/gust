import { EffectToken, Tokens } from "../types";
import { getCssVariableName, isTokenReference, sanitizeName } from "../util";

const SHADOW_TYPE = "custom-shadow";

function getBoxShadowValue({
  color,
  offsetX,
  offsetY,
  radius,
  spread,
}: EffectToken["value"]): string {
  // If the color is a reference to another token, convert it to a CSS variable.
  const renderedColor = isTokenReference(color)
    ? getCssVariableName(color, "color")
    : color;

  return `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${renderedColor}`;
}

export function generateShadowCss(tokens: Tokens): string {
  const effectTokens = tokens.effect || {};
  const tokenKeys = Object.keys(effectTokens);

  // Map effect tokens to list of CSS variables for shadows.
  const shadowTokens = tokenKeys.reduce(
    (acc, key) => {
      const token = effectTokens[key];
      const isSingleShadow = token.type === SHADOW_TYPE;
      const hasChildTokens = Object.values(token).some(
        (layer) => layer && layer.type === SHADOW_TYPE,
      );

      // An effect token may be …
      if (isSingleShadow) {
        // … a single shadow object.
        // Add the value directly.
        return { ...acc, [key]: token.value };
      } else if (hasChildTokens) {
        // … or an object containing multiple shadow layers.
        // Add an array of each layer's value.
        const multiLayerValues = Object.values(token)
          .map((layer) =>
            layer?.type === SHADOW_TYPE ? layer.value : undefined,
          )
          .filter(Boolean);

        return { ...acc, [key]: multiLayerValues };
      }

      return acc;
    },
    {} as Record<string, EffectToken["value"] | EffectToken["value"][]>,
  );

  // Map tokens to CSS string of Tailwind theme block containing shadow variables.
  const shadowCSS = Object.keys(shadowTokens)
    .map((key) => {
      const value = shadowTokens[key];
      const sanitizedKey = sanitizeName(key);

      const boxShadowValue = Array.isArray(value)
        ? value.map(getBoxShadowValue).join(", ")
        : getBoxShadowValue(value);

      return `  --shadow-${sanitizedKey}: ${boxShadowValue};\n`;
    })
    .join("");

  return "@theme {\n" + shadowCSS + "}\n";
}
