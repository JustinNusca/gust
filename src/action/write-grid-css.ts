import { join, resolve } from "path";

import { writeCssFile } from "#action/write-css-file";
import { buildUtilityBlocks } from "#util/css-domain";
import { formatCssBlock } from "#util/css-format";
import {
  type GridEntry,
  type ResolvedGrid,
  stripGridNameFragments,
} from "#util/grid";
import { withUniqueCssNames } from "#util/names";

type NamedEntry = GridEntry & { cssName: string };

function buildThemeBlock(entries: NamedEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.columns !== undefined) {
      lines.push(`  --layout-${entry.cssName}-columns: ${entry.columns};`);
    }
    if (entry.rows !== undefined) {
      lines.push(`  --layout-${entry.cssName}-rows: ${entry.rows};`);
    }
    if (entry.columnGap !== undefined) {
      lines.push(`  --layout-${entry.cssName}-gap-x: ${entry.columnGap};`);
    }
    if (entry.rowGap !== undefined) {
      lines.push(`  --layout-${entry.cssName}-gap-y: ${entry.rowGap};`);
    }
    if (entry.paddingX !== undefined) {
      lines.push(`  --layout-${entry.cssName}-padding-x: ${entry.paddingX};`);
    }
    if (entry.paddingY !== undefined) {
      lines.push(`  --layout-${entry.cssName}-padding-y: ${entry.paddingY};`);
    }
    if (entry.cellSize !== undefined) {
      lines.push(`  --layout-${entry.cssName}-cell: ${entry.cellSize};`);
    }
    if (entry.maxWidth !== undefined) {
      lines.push(`  --layout-${entry.cssName}-max-width: ${entry.maxWidth};`);
    }
  }
  return formatCssBlock("@theme", lines);
}

function buildUtilityBody(entry: NamedEntry): string[] | null {
  const lines: string[] = ["  @apply grid;"];
  const prefix = `var(--layout-${entry.cssName}`;

  if (entry.columns !== undefined) {
    lines.push(
      `  grid-template-columns: repeat(${prefix}-columns), minmax(0, 1fr));`,
    );
  }
  if (entry.rows !== undefined) {
    lines.push(
      `  grid-template-rows: repeat(${prefix}-rows), minmax(0, 1fr));`,
    );
  }
  if (entry.cellSize !== undefined && entry.columns === undefined) {
    lines.push(
      `  grid-template-columns: repeat(auto-fill, minmax(${prefix}-cell), 1fr));`,
    );
  }
  if (entry.columnGap !== undefined) {
    lines.push(`  column-gap: ${prefix}-gap-x);`);
  }
  if (entry.rowGap !== undefined) {
    lines.push(`  row-gap: ${prefix}-gap-y);`);
  }
  if (entry.paddingX !== undefined) {
    lines.push(`  padding-inline: ${prefix}-padding-x);`);
  }
  if (entry.paddingY !== undefined) {
    lines.push(`  padding-block: ${prefix}-padding-y);`);
  }
  if (entry.maxWidth !== undefined) {
    lines.push(`  max-width: ${prefix}-max-width);`);
    lines.push(`  margin-inline: auto;`);
  }

  return lines.length === 1 ? null : lines;
}

function buildGridCss(grid: ResolvedGrid): string {
  const entries = withUniqueCssNames(grid.entries, stripGridNameFragments).sort(
    (a, b) => a.cssName.localeCompare(b.cssName),
  );
  const blocks: string[] = [
    buildThemeBlock(entries),
    ...buildUtilityBlocks({
      entries,
      prefix: "layout",
      bodyFor: buildUtilityBody,
    }),
  ];
  return `${blocks.join("\n\n")}\n`;
}

export async function writeGridCss(
  grid: ResolvedGrid,
  outputDir: string,
): Promise<string> {
  const filePath = join(resolve(outputDir), "theme", "grid.css");
  return writeCssFile(filePath, buildGridCss(grid), "Grid");
}
