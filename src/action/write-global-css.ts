import { join, relative, resolve } from "path";

import { writeCssFile } from "#action/write-css-file";

export interface GlobalCssOptions {
  hasPalette: boolean;
  hasRadii: boolean;
  hasEffects: boolean;
  hasGradients: boolean;
  hasFonts: boolean;
  hasTypography: boolean;
  hasGrid: boolean;
  componentOutputDir?: string;
}

const STATIC_BASE_LAYER = `@layer base {
  * {
    @apply antialiased;
  }

  button:not(:disabled),
  select:not(:disabled),
  [role="button"] {
    @apply cursor-pointer;
  }
}`;

function formatSourcePath(outputDir: string, componentOutputDir: string) {
  let sourcePath = relative(
    resolve(outputDir),
    resolve(componentOutputDir),
  ).replace(/\\/g, "/");

  if (sourcePath === "") {
    sourcePath = ".";
  }
  if (!sourcePath.startsWith(".")) {
    sourcePath = `./${sourcePath}`;
  }
  if (!sourcePath.endsWith("/")) {
    sourcePath = `${sourcePath}/`;
  }

  return sourcePath;
}

function buildGlobalCss(outputDir: string, options: GlobalCssOptions): string {
  const blocks: string[] = [
    `@import "tailwindcss"`,
    [
      options.hasEffects && `@import "./theme/effects.css";`,
      options.hasFonts && `@import "./theme/fonts.css";`,
      options.hasGradients && `@import "./theme/gradients.css";`,
      options.hasGrid && `@import "./theme/grid.css";`,
      options.hasPalette && `@import "./theme/palette.css";`,
      options.hasRadii && `@import "./theme/radii.css";`,
      options.hasTypography && `@import "./theme/typography.css";`,
    ]
      .filter(Boolean)
      .sort()
      .join("\n"),
  ].filter(Boolean) as string[];

  if (options.componentOutputDir) {
    const sourcePath = formatSourcePath(outputDir, options.componentOutputDir);
    blocks.push(`@source "${sourcePath}";`);
  }

  blocks.push(STATIC_BASE_LAYER);

  return `${blocks.join("\n\n")}\n`;
}

export async function writeGlobalCss(
  outputDir: string,
  options: GlobalCssOptions,
): Promise<string> {
  const resolvedOutputDir = resolve(outputDir);
  const filePath = join(resolvedOutputDir, "global.css");
  const css = buildGlobalCss(resolvedOutputDir, options);
  return writeCssFile(filePath, css, "Global CSS");
}
