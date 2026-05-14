import boxen from "boxen";
import chalk from "chalk";

type Chalk = (input: string) => string;

/**
 * Emits `lines` as a single visual block: the first line is prefixed with
 * `icon`, subsequent lines are indented to align under the message text.
 * Each line is colorized with `color`. Skips the leading blank line and
 * returns early when no lines are provided.
 */
function printBlock(
  icon: string,
  color: Chalk,
  lines: string[],
  out: (text: string) => void,
) {
  if (lines.length === 0) return;

  console.log();
  const [first, ...rest] = lines;

  out(color(`${icon} ${chalk.bold(first)}`));
  rest.forEach((line) => out(color(`   ${line}`)));
}

/**
 * Prints a yellow ⚠️-prefixed warning. Used for non-fatal notices (skipped
 * output, missing optional state) where execution should continue. Each
 * argument is rendered as its own line; subsequent lines are indented to
 * align under the first line's text.
 */
export function showWarning(...lines: string[]) {
  printBlock("⚠️", chalk.yellow, lines, (text) => console.warn(text));
}

/**
 * Renders multiple warnings in a single boxen block with a yellow border
 * and title.
 */
export function showWarnings(warnings: (string | string[])[]) {
  if (warnings.length === 0) return;

  const body = warnings
    .map((lines) => {
      const [first, ...rest] = lines;
      return [
        chalk.yellow.bold(first),
        ...rest.map((line) => chalk.yellow(line)),
      ].join("\n");
    })
    .join("\n\n");

  console.log();
  console.warn(
    boxen(body, {
      borderColor: "yellow",
      borderStyle: "round",
      padding: 2,
      title: chalk.yellow.bold("  ⚠️ Warnings  "),
    }),
  );
}

/**
 * Prints a green ✅-prefixed success message confirming a completed action
 * (file written, login succeeded). Each argument is rendered as its own
 * line; subsequent lines are indented to align under the first line's text.
 */
export function showSuccess(...lines: string[]) {
  printBlock("✅", chalk.green, lines, (text) => console.log(text));
}

/**
 * Prints visually-dimmed message for auxiliary details (counts, file paths,
 * debug summaries, etc). Each argument is rendered as its own line.
 */
export function showDebug(...lines: string[]) {
  lines.forEach((line) => console.debug(chalk.dim(line)));
}

/**
 * Prints a red ❌-prefixed error message. Used for fatal errors that cause
 * execution to stop (network failure, invalid input).
 */
export function showError(error: Error | string) {
  console.log();
  console.error(
    chalk.bold.red("\n❌ An error occurred during theme generation:"),
  );
  console.log();
  console.error(chalk.red(error));
  console.log();
}

/**
 * Top-level catch handler for exiting with an error. Exits silently when user
 * aborts an inquirer prompt with Ctrl+C, and falls back to `showError` + exit 1
 * for any other error.
 */
export function exitWithError(error: unknown): never {
  if ((error as Error)?.name === "ExitPromptError") {
    process.exit(130);
  }
  showError(error as Error);
  process.exit(1);
}
