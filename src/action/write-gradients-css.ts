import { join, resolve } from "path";

import { writeCssFile } from "#action/write-css-file";
import { buildUtilityBlocks } from "#util/css-domain";
import {
  type ResolvedGradients,
  stripGradientNameFragments,
} from "#util/gradients";
import { withUniqueCssNames } from "#util/names";

function buildGradients(gradients: ResolvedGradients): string {
  const entries = withUniqueCssNames(
    gradients.entries,
    stripGradientNameFragments,
  );

  const blocks = buildUtilityBlocks({
    entries,
    prefix: "bg-gradient",
    bodyFor: ({ value }) => [`  background-image: ${value};`],
  });

  return `${blocks.join("\n\n")}\n`;
}

export async function writeGradientsCss(
  gradients: ResolvedGradients,
  outputDir: string,
): Promise<string> {
  const filePath = join(resolve(outputDir), "theme", "gradients.css");
  return writeCssFile(filePath, buildGradients(gradients), "Gradients");
}
