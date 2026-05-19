import { mkdir, writeFile } from "fs/promises";
import { dirname, relative } from "path";

import { showSuccess } from "#action/show-message";

/**
 * Writes `css` to `filePath`, creating parent directories as needed, then
 * surfaces a `{label} written to ...` success message. Callers resolve their
 * own absolute path so the helper stays agnostic about output layout (e.g.
 * `theme/X.css` vs. a top-level `global.css`).
 */
export async function writeCssFile(
  filePath: string,
  css: string,
  label: string,
): Promise<string> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, css);
  showSuccess(`${label} written to ${relative(process.cwd(), filePath)}.`);
  return filePath;
}
