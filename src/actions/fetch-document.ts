import {
  GetFileNodesResponse,
  GetFileResponse,
  GetFileStylesResponse,
  GetLocalVariablesResponse,
  Paint,
  PublishedStyle,
  RGBA,
  Style,
  VariableAlias,
} from "@figma/rest-api-spec";
import { FontToken, PaletteToken } from "../types";
import {
  findStyleInTree,
  formatRGBA,
  parsePaletteValue,
  sanitizeName,
} from "../util";
import chalk from "chalk";

export interface FetchedTokens {
  font: Record<string, FontToken>;
  palette: Record<string, PaletteToken>;
}

function mapDocumentPaletteStylesToNodes(
  styles: GetFileResponse["styles"],
  document: GetFileResponse["document"],
) {
  const tokens = {} as Record<string, PaletteToken>;
  const styleEntries = Object.entries(styles);

  styleEntries.forEach(([key, style]) => {
    if (style.styleType === "FILL") {
      const node = findStyleInTree(document, key);

      if (node && "fills" in node) {
        const fills = node.fills as (Paint & { color: RGBA })[];
        const sanitizedName = sanitizeName(style.name);

        tokens[sanitizedName] = {
          id: key,
          name: sanitizedName,
          type: "COLOR",
          value: formatRGBA(fills[0].color || { r: 0, g: 0, b: 0, a: 1 }),
        };
      }
    }
  });

  return tokens;
}

function mapDocumentTextStylesToNodes(
  styles: GetFileResponse["styles"],
  document: GetFileResponse["document"],
) {
  const tokens = {} as Record<string, FontToken>;
  const styleEntries = Object.entries(styles);

  styleEntries.forEach(([key, style]) => {
    if (style.styleType === "TEXT") {
      const node = findStyleInTree(document, key, "text");

      if (node) {
        const sanitizedName = sanitizeName(style.name);

        tokens[sanitizedName] = {
          id: key,
          name: sanitizedName,
          type: "TEXT",
          value: (node as unknown as Record<"style", Record<string, Style>>)
            .style,
        } as FontToken;
      }
    }
  });

  return tokens;
}

function parsePaletteVariables(
  variables: GetLocalVariablesResponse["meta"]["variables"],
) {
  const paletteTokens = {} as Record<string, PaletteToken>;
  const variableEntries = Object.entries(variables);

  variableEntries.forEach(([key, value]) => {
    if (value.resolvedType === "COLOR") {
      const sanitizedName = sanitizeName(value.name);
      const modeValue = value.valuesByMode[
        Object.keys(value.valuesByMode)[0] as keyof typeof value.valuesByMode
      ] as VariableAlias | RGBA | string;
      const parsedModeValue = parsePaletteValue(modeValue, variableEntries);

      paletteTokens[sanitizedName] = {
        id: key,
        type: "COLOR",
        value: parsedModeValue,
      } as PaletteToken;
    }
  });

  return paletteTokens;
}

function parseTypographyLibraryStyles(
  styles: PublishedStyle[],
  nodes: GetFileNodesResponse["nodes"],
) {
  const typographyTokens = {} as Record<string, FontToken>;

  styles.forEach(({ node_id, name, style_type }) => {
    if (style_type === "TEXT") {
      const node = nodes[node_id];

      typographyTokens[node.document.name] = {
        name,
        id: node_id,
        type: style_type,
        value: (node.document as { style: Record<string, Style> }).style,
      } as FontToken;
    }
  });

  return typographyTokens;
}

export async function fetchDocument(key: string): Promise<FetchedTokens> {
  try {
    const headers = new Headers();
    const params = new URLSearchParams();

    headers.set("X-Figma-Token", process.env.FIGMA_PA_TOKEN || "");

    const stylesResult = await fetch(
      `https://api.figma.com/v1/files/${key}/styles`,
      { headers },
    );
    const parsedStylesResult =
      (await stylesResult.json()) as GetFileStylesResponse;
    const styleNodeIds = parsedStylesResult.meta.styles.map(
      ({ node_id }) => node_id,
    );
    const styleNodeCount = styleNodeIds.length;

    params.append("ids", styleNodeIds.join(","));
    const nodesResult = await fetch(
      `https://api.figma.com/v1/files/${key}/nodes?${params}`,
      { headers },
    );
    const parsedNodesResult =
      (await nodesResult.json()) as GetFileNodesResponse;

    const variablesResult = await fetch(
      `https://api.figma.com/v1/files/${key}/variables/local`,
      { headers },
    );
    const parsedVariablesResult =
      (await variablesResult.json()) as GetLocalVariablesResponse;
    const paletteTokens = parsePaletteVariables(
      parsedVariablesResult.meta.variables,
    );
    const paletteTokenCount = Object.keys(paletteTokens).length;

    // If no palette tokens are found in the file's local variables,
    // we will fall back to using document styles.
    if (paletteTokenCount === 0) {
      console.warn(
        chalk.yellowBright(
          `\n⚠️ ${chalk.bold("No color variables found!")} Ensure your Figma file has local variables defined.`,
        ),
        chalk.italic(
          `\n   You can add them in Figma's “${chalk.cyanBright("Design mode")}”, by pressing the “${chalk.cyanBright("Variable settings")}” icon in the right-side panel.`,
        ),
      );
    }

    if (styleNodeCount === 0) {
      console.warn(
        chalk.yellowBright(
          `\n⚠️ ${chalk.bold("No text styles found in file library!")} Ensure your Figma file has text styles in a published library.`,
        ),
        chalk.italic(
          `\n   Learn more about publishing libraries at ${chalk.cyanBright("https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles")}`,
        ),
      );
    }

    if (paletteTokenCount === 0 || styleNodeCount === 0) {
      console.log(
        chalk.bold.yellowBright(`\n⚠️ Falling back to document styles…`),
      );

      const result = await fetch(`https://api.figma.com/v1/files/${key}`, {
        headers,
      });
      const parsedResult = (await result.json()) as GetFileResponse;
      const documentPaletteTokens = mapDocumentPaletteStylesToNodes(
        parsedResult.styles,
        parsedResult.document,
      );
      const documentFontTokens = mapDocumentTextStylesToNodes(
        parsedResult.styles,
        parsedResult.document,
      );

      return {
        palette: documentPaletteTokens,
        font: documentFontTokens,
      };
    }

    return {
      palette: parsePaletteVariables(parsedVariablesResult.meta.variables),
      font: parseTypographyLibraryStyles(
        parsedStylesResult.meta.styles,
        parsedNodesResult.nodes,
      ),
    };
  } catch (e) {
    console.error("OH NO", e);
    return { font: {}, palette: {} };
  }
}
