import { input } from "@inquirer/prompts";
import chalk from "chalk";

export async function outputDirPrompt() {
  console.log();
  console.log(
    chalk.bold("Where should the generated CSS theme files be written?"),
  );
  console.log(
    chalk.italic(
      "Provide a path relative to the current directory. A `theme/` folder will be created inside it, EG: ",
    ),
  );
  console.log(chalk.cyan("./src/styles"));
  console.log();

  const outputDir = await input({
    message: "Output directory",
    default: "./src/styles",
    validate: (value) =>
      value.trim().length > 0 || "An output directory is required.",
  });

  return { outputDir: outputDir.trim() };
}
