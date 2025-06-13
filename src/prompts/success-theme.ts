import chalk from "chalk";

export function successThemePrompt(outputDir: string) {
  console.log(
    chalk.green.bold(
      "\n✅ Successfully generated theme files in " +
        chalk.reset.italic(outputDir),
    ),
  );
}
