import { join, resolve } from "path";

import { writeCssFile } from "#action/write-css-file";
import { buildDomainBlocks } from "#util/css-domain";
import { sanitizeName } from "#util/names";
import { type ResolvedRadii, stripRadiusNameFragments } from "#util/radii";

const STATIC_NONE = "  --radius-none: 0;";
const STATIC_FULL = "  --radius-full: 100%;";

function buildRadiiCss(radii: ResolvedRadii): string {
  const blocks = buildDomainBlocks({
    core: radii.core,
    modes: radii.modes,
    prefix: "radius",
    cssName: (name) => stripRadiusNameFragments(sanitizeName(name)),
    skipCssName: (cssName) => cssName === "none" || cssName === "full",
    prependDefault: [STATIC_NONE],
    appendDefault: [STATIC_FULL],
  });

  return `${blocks.join("\n\n")}\n`;
}

export async function writeRadiiCss(
  radii: ResolvedRadii,
  outputDir: string,
): Promise<string> {
  const filePath = join(resolve(outputDir), "theme", "radii.css");
  return writeCssFile(filePath, buildRadiiCss(radii), "Radii");
}
