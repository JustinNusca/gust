import chalk from "chalk";

export function successTextPrompt(outputDir: string) {
  console.log(
    chalk.green.bold(
      "✅ Successfully generated Text/index.tsx in " +
        chalk.reset.italic(outputDir),
    ),
  );
}
