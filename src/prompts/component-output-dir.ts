import chalk from "chalk";
import inquirer from "inquirer";

export async function componentOutputDirPrompt() {
  console.log(
    chalk.bold("\nPlease enter the path to the component output directory:"),
  );

  return inquirer.prompt({
    default: "./components/",
    message: chalk.reset("Output path:"),
    name: "componentOutputDir",
    type: "input",
  });
}
