import chalk from "chalk";
import inquirer from "inquirer";

export async function inputDirPrompt() {
  console.log(chalk.bold("\nPlease enter the path to the token JSON file:"));

  return inquirer.prompt({
    default: "./tokens.json",
    message: chalk.reset("Input path:"),
    name: "inputDir",
    type: "input",
  });
}
