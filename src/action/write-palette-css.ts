import { join, resolve } from "path";

import { writeCssFile } from "#action/write-css-file";
import { buildDomainBlocks } from "#util/css-domain";
import type { ResolvedPalette } from "#util/palette";

function buildPalette(palette: ResolvedPalette): string {
  const blocks = buildDomainBlocks({
    core: palette.core,
    modes: palette.modes,
    prefix: "color",
  });
  return `${blocks.join("\n\n")}\n`;
}

export async function writePaletteCss(
  palette: ResolvedPalette,
  outputDir: string,
) {
  const filePath = join(resolve(outputDir), "theme", "palette.css");
  return writeCssFile(filePath, buildPalette(palette), "Palette");
}
