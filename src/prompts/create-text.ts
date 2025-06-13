import inquirer from "inquirer";
import chalk from "chalk";

export async function createTextPrompt() {
  console.log(
    chalk.bold("\nInclude a React-based Text component?") +
      chalk.italic(
        "\nThis adds a pre-built component for applying typographic styles via props, EG: ",
      ) +
      chalk.cyan(
        `<${chalk.cyanBright("Text")} ${chalk.yellow("variant")}=${chalk.green('"header-1"')} />`,
      ),
  );

  return inquirer.prompt({
    default: true,
    message: chalk.reset("Add Text component:"),
    name: "createComponent",
    type: "confirm",
  });
}
