import { CanvasNode, Node } from "@figma/rest-api-spec";
import { Token, Tokens } from "../types";
import { sanitizeName } from "./names";

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

export function sortColorTokens(a: string, b: string) {
  if (a.includes("var(--color-") && !b.includes("var(--color-")) {
    return 1;
  }

  if (!a.includes("var(--color-") && b.includes("var(--color-")) {
    return -1;
  }

  return a.localeCompare(b);
}

export function isLeaf(node: Node) {
  return node && !("children" in node);
}

export function findStyleInTree(
  node: Node & { styles?: { fill?: string; text?: string } },
  key: string,
  styleKey: "fill" | "text" = "fill",
): CanvasNode | undefined {
  if (isLeaf(node)) {
    const isMatch =
      "styles" in node && node.styles && node.styles?.[styleKey] === key;

    return isMatch ? (node as CanvasNode) : undefined;
  } else {
    return "children" in node
      ? node.children
          .map((child) => findStyleInTree(child, key, styleKey))
          .filter(Boolean)
          .reduce(
            (accumulator, current) =>
              accumulator !== undefined ? accumulator : current,
            undefined,
          )
      : undefined;
  }
}
