import { join, resolve } from "path";

import { writeCssFile } from "#action/write-css-file";
import { buildThemeLines, buildUtilityBlocks } from "#util/css-domain";
import { formatCssBlock } from "#util/css-format";
import {
  type ResolvedEffects,
  stripBlurNameFragments,
  stripShadowNameFragments,
} from "#util/effects";
import { withUniqueCssNames } from "#util/names";

function buildEffectsCss(effects: ResolvedEffects): string {
  const blocks: string[] = [];

  const shadowEntries = withUniqueCssNames(
    effects.themed.shadows,
    stripShadowNameFragments,
  );
  const layerBlurEntries = withUniqueCssNames(
    effects.themed.layerBlurs,
    stripBlurNameFragments,
  );
  const backgroundBlurEntries = withUniqueCssNames(
    effects.utilities.backgroundBlurs,
    stripBlurNameFragments,
  );

  const shadow = buildThemeLines({
    entries: shadowEntries,
    prefix: "shadow",
    valueFor: ({ value }) => value,
  });
  const blur = buildThemeLines({
    entries: layerBlurEntries,
    prefix: "blur",
    valueFor: ({ radius }) => `${radius}px`,
  });

  const tokenLines = [...shadow.tokenLines, ...blur.tokenLines];
  if (tokenLines.length > 0) {
    const resets = [shadow.resetLine, blur.resetLine].filter(
      (line): line is string => line !== null,
    );
    blocks.push(formatCssBlock("@theme", [...resets, ...tokenLines]));
  }

  blocks.push(
    ...buildUtilityBlocks({
      entries: backgroundBlurEntries,
      prefix: "backdrop-blur",
      bodyFor: ({ radius }) => [`  backdrop-filter: blur(${radius}px);`],
    }),
  );

  return `${blocks.join("\n\n")}\n`;
}

export async function writeEffectsCss(
  effects: ResolvedEffects,
  outputDir: string,
): Promise<string> {
  const filePath = join(resolve(outputDir), "theme", "effects.css");
  return writeCssFile(filePath, buildEffectsCss(effects), "Effects");
}
