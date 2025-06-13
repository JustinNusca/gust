import chalk from "chalk";
import inquirer from "inquirer";

export async function outputDirPrompt() {
  console.log(
    chalk.bold("\nPlease enter the path to the CSS output directory:"),
  );

  return inquirer.prompt({
    default: "./theme",
    message: chalk.reset("Output path:"),
    name: "outputDir",
    type: "input",
  });
}
