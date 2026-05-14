import { mkdir, writeFile } from "fs/promises";
import { join, relative } from "path";

import type { ParsedFigmaVariables } from "#action/parse-figma-variables";
import { showDebug } from "#action/show-message";
import type { FigmaResources } from "#util/figma-api";
import type { ResolvedPalette } from "#util/palette";
import { ResolvedDomain } from "#util/resolved";

const DEBUG_DIR = ".gust";

/**
 * JSON replacer that serializes `Map` instances as plain objects. Resolved
 * domain outputs (e.g. `ResolvedPalette.semanticByValue`) carry Maps which
 * `JSON.stringify` otherwise drops to `{}`.
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  return value instanceof Map ? Object.fromEntries(value) : value;
}

export async function writeDebugJson(
  filename: string,
  data: unknown,
  label: string,
) {
  const debugDir = join(process.cwd(), DEBUG_DIR);
  const debugPath = join(debugDir, filename);

  await mkdir(debugDir, { recursive: true });
  await writeFile(debugPath, JSON.stringify(data, jsonReplacer, 2));

  showDebug(`${label} saved to ${relative(process.cwd(), debugPath)}.`);
}

export function saveFigmaSnapshot(data: FigmaResources) {
  return writeDebugJson("figma-snapshot.json", data, "Snapshot");
}

export function saveParsedVariables(data: ParsedFigmaVariables) {
  return writeDebugJson("parsed-variables.json", data, "Parsed variables");
}

export function saveResolvedThemeDomain(data: ResolvedDomain, domain: string) {
  return writeDebugJson(`resolved-${domain}.json`, data, `Resolved ${domain}`);
}

export function saveResolvedPalette(data: ResolvedPalette) {
  return writeDebugJson("resolved-palette.json", data, "Resolved palette");
}
