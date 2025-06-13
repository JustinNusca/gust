import chalk from "chalk";

export function errorPrompt(error: Error | string) {
  console.error(
    chalk.bold.red("\n❌ An error occurred during theme generation:\n"),
  );
  console.error(chalk.red(error));
}
