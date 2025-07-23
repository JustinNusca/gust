import { LocalVariable, RGB, RGBA, VariableAlias } from "@figma/rest-api-spec";
import { roundWithDecimals } from "./round-with-decimals";
import { sanitizeName } from "./names";

export function formatRGBA({ r, g, b, a }: RGB & { a?: number }): string {
  return `rgb(${roundWithDecimals(r * 255, 0)} ${roundWithDecimals(g * 255, 0)} ${roundWithDecimals(b * 255, 0)} / ${roundWithDecimals(a || 1)})`;
}

export function parsePaletteValue(
  value: VariableAlias | RGBA | string,
  variables: [string, LocalVariable][],
): string {
  if (typeof value === "string") {
    return value;
  }

  if ("type" in value && value.type === "VARIABLE_ALIAS") {
    const aliasedVariable = variables.find(([key]) => key === value.id)?.[1];

    return `{${sanitizeName(aliasedVariable?.name || value.id)}}`;
  }

  if ("r" in value) {
    return formatRGBA(value);
  }

  return "";
}
