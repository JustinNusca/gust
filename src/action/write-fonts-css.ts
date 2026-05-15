import { join, resolve } from "path";

import { writeCssFile } from "#action/write-css-file";
import { formatCssBlock } from "#util/css-format";
import type { ResolvedFonts } from "#util/fonts";
import { sanitizeName } from "#util/names";

function buildFontsCss(fonts: ResolvedFonts): string {
  const blocks = fonts.entries.map(
    ({ family, weight, italic, postScriptName }) => {
      const fileName = `${sanitizeName(postScriptName)}.woff2`;
      const lines = [
        `  font-family: "${family}";`,
        `  src: url("../assets/font/${fileName}") format("woff2");`,
        `  font-weight: ${weight};`,
      ];
      if (italic) lines.push(`  font-style: italic;`);
      return formatCssBlock("@font-face", lines);
    },
  );

  return `${blocks.join("\n\n")}\n`;
}

export async function writeFontsCss(
  fonts: ResolvedFonts,
  outputDir: string,
): Promise<string> {
  const filePath = join(resolve(outputDir), "theme", "fonts.css");
  return writeCssFile(filePath, buildFontsCss(fonts), "Fonts");
}
