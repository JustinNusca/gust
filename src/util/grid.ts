import type { LayoutGrid } from "@figma/rest-api-spec";

import type { ParsedFigma } from "#action/parse-figma-response";
import type { ParsedFigmaStyle } from "#action/parse-figma-styles";
import { GRID_NAME_FRAGMENT_PATTERN } from "#util/name-patterns";
import { stripNameFragments } from "#util/names";
import type { ResolvedDomain } from "#util/resolved";

export interface GridEntry {
  name: string;
  /** Column count for the `COLUMNS` layout grid on this style, if present. */
  columns?: number;
  /** Row count for the `ROWS` layout grid on this style, if present. */
  rows?: number;
  /** Column gutter (`px`) from the `COLUMNS` layout grid. */
  columnGap?: string;
  /** Row gutter (`px`) from the `ROWS` layout grid. */
  rowGap?: string;
  /**
   * Inline padding (`px`) — Figma's `offset` on the `COLUMNS` layout grid.
   * Only emitted when the grid is `MIN`/`MAX` aligned (offset is meaningless
   * for `STRETCH` and `CENTER`).
   */
  paddingX?: string;
  /** Block padding (`px`) — `offset` on the `ROWS` layout grid. */
  paddingY?: string;
  /** Section size (`px`) for the square `GRID` pattern, if present. */
  cellSize?: string;
  /**
   * Max width (`px`), inferred from the source node's frame width. Only set
   * when the `COLUMNS` grid is `MIN`/`MAX`/`CENTER` aligned — `STRETCH` grids
   * fill their container, so the frame width is just the artboard size and
   * shouldn't pin a max-width.
   */
  maxWidth?: string;
}

export interface ResolvedGrid extends ResolvedDomain {
  entries: GridEntry[];
}

const isGridStyle = (style: ParsedFigmaStyle): boolean =>
  style.styleType === "GRID" && style.layoutGrids.length > 0;

const isVisible = (grid: LayoutGrid): boolean => grid.visible !== false;

/**
 * Picks the first visible layout grid matching `pattern`. A Figma GRID style
 * may carry several layout grids (one per axis), but each axis is uniquely
 * defined so the first match is authoritative.
 */
function pickGrid(
  grids: LayoutGrid[],
  pattern: LayoutGrid["pattern"],
): LayoutGrid | undefined {
  return grids.find((g) => g.pattern === pattern && isVisible(g));
}

/**
 * Returns the offset as a `px` string, or `undefined` when the grid is
 * `STRETCH`/`CENTER` aligned. Figma still carries an `offset` for those
 * alignments but it doesn't translate to a meaningful padding value.
 */
function pickOffsetPadding(grid: LayoutGrid | undefined): string | undefined {
  if (!grid) return undefined;
  if (grid.alignment !== "MIN" && grid.alignment !== "MAX") return undefined;
  return `${grid.offset}px`;
}

function buildEntry(style: ParsedFigmaStyle): GridEntry | null {
  const columns = pickGrid(style.layoutGrids, "COLUMNS");
  const rows = pickGrid(style.layoutGrids, "ROWS");
  const cells = pickGrid(style.layoutGrids, "GRID");

  const entry: GridEntry = { name: style.name };
  if (columns) {
    entry.columns = columns.count;
    if (columns.gutterSize > 0) entry.columnGap = `${columns.gutterSize}px`;
    entry.paddingX = pickOffsetPadding(columns);
  }
  if (rows) {
    entry.rows = rows.count;
    if (rows.gutterSize > 0) entry.rowGap = `${rows.gutterSize}px`;
    entry.paddingY = pickOffsetPadding(rows);
  }
  if (cells) entry.cellSize = `${cells.sectionSize}px`;

  if (
    style.nodeWidth !== undefined &&
    columns &&
    columns.alignment !== "STRETCH"
  ) {
    entry.maxWidth = `${style.nodeWidth}px`;
  }

  const hasAny =
    entry.columns !== undefined ||
    entry.rows !== undefined ||
    entry.cellSize !== undefined ||
    entry.columnGap !== undefined ||
    entry.rowGap !== undefined ||
    entry.paddingX !== undefined ||
    entry.paddingY !== undefined ||
    entry.maxWidth !== undefined;
  return hasAny ? entry : null;
}

/**
 * Resolves a `ParsedFigma` into a writer-ready grid set. Filters to GRID
 * styles whose source node carries at least one visible layout grid, then
 * collapses each style's per-axis layout grids (COLUMNS/ROWS/GRID) into a
 * single entry. Styles with no usable layout data are dropped.
 */
export function resolveGrid(parsed: ParsedFigma): ResolvedGrid {
  const entries: GridEntry[] = [];
  for (const style of Object.values(parsed.styles)) {
    if (!isGridStyle(style)) continue;
    const entry = buildEntry(style);
    if (entry) entries.push(entry);
  }
  return { isEmpty: entries.length === 0, entries };
}

/**
 * Strips grid-domain fragments (`grid`, `layout`, `column`, `row`) from a
 * sanitized token name so that source names like `grid-layout-desktop`
 * collapse to `desktop` before being prefixed with `layout-` in the CSS output.
 */
export function stripGridNameFragments(name: string): string {
  return stripNameFragments(name, GRID_NAME_FRAGMENT_PATTERN);
}
