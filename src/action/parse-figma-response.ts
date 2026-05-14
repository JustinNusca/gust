import chalk from "chalk";
import { oraPromise } from "ora";

import { saveParsedVariables } from "#action/debug";
import {
  type ParsedFigmaStyles,
  parseFigmaStyles,
} from "#action/parse-figma-styles";
import {
  type ParsedFigmaVariables,
  parseFigmaVariables,
} from "#action/parse-figma-variables";
import { showDebug } from "#action/show-message";
import type { FigmaResources } from "#util/figma-api";
import { type ParsedThemes } from "#util/figma-variables";

export interface ParsedFigma {
  variables: ParsedFigmaVariables;
  styles: ParsedFigmaStyles;
  themes: ParsedThemes;
}

export async function parseFigmaResponse(
  resources: FigmaResources,
  debug = false,
): Promise<ParsedFigma> {
  console.log();
  const result = await oraPromise(
    Promise.resolve().then((): ParsedFigma => {
      const variables = parseFigmaVariables(resources);
      const styles = parseFigmaStyles(resources);

      if (variables.skippedRemoteCollections.size > 0) {
        const names = [...variables.skippedRemoteCollections]
          .map((name) => `"${name}"`)
          .join(", ");
        showDebug(
          `Skipped ${variables.skippedRemoteCollections.size} remote collection(s) imported from libraries:`,
          chalk.cyan(names),
          `Their values are still resolved through aliases.`,
        );
      }
      showDebug(
        `Parsed ${Object.keys(variables.parsed).length} variables, ${Object.keys(styles).length} styles.`,
      );

      return {
        variables: variables.parsed,
        styles,
        themes: variables.themes,
      };
    }),
    {
      text: "Parsing Figma resources…",
      successText: "Figma resources parsed!",
      failText: "Failed to parse Figma resources!",
    },
  );

  if (debug) {
    await saveParsedVariables(result.variables);
  }

  return result;
}
