import { select } from "@inquirer/prompts";
import chalk from "chalk";

export async function createTextPrompt() {
  console.log();
  console.log(chalk.bold("Also generate a React-based Text component?"));
  console.log(
    chalk.italic(
      "This adds a pre-built component for applying typographic styles via props, EG: ",
    ),
  );
  console.log(
    chalk.cyan(
      `<${chalk.cyanBright("Text")} ${chalk.yellow("variant")}=${chalk.green('"header-1"')} />`,
    ),
  );
  console.log();

  const createComponent = await select<boolean>({
    message: "Create Text component?",
    default: false,
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
  });

  return { createComponent };
}
