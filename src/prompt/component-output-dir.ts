import { input } from "@inquirer/prompts";
import chalk from "chalk";

export async function componentOutputDirPrompt() {
  console.log();
  console.log(chalk.bold("Where should the Text component be written?"));
  console.log(
    chalk.italic("Provide a path relative to the current directory, EG: "),
  );
  console.log(chalk.cyan("./src/components"));
  console.log();

  const componentOutputDir = await input({
    message: "Component directory",
    default: "./src/components",
    validate: (value) =>
      value.trim().length > 0 || "A component output directory is required.",
  });

  return { componentOutputDir: componentOutputDir.trim() };
}
