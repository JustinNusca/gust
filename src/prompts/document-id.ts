import inquirer from "inquirer";
import chalk from "chalk";

export async function documentIDPrompt() {
  console.log(
    chalk.bold("\nEnter the ID of the document to generate a theme for.") +
      chalk.italic(
        "\nThis can be retrieved from the URL of the document in Figma, EG: ",
      ) +
      chalk.cyan(
        `https://www.figma.com/:file_type/${chalk.yellow(":file_ID")}/:file_name`,
      ),
  );

  return inquirer.prompt({
    message: chalk.reset("Document ID:"),
    name: "documentID",
    type: "input",
  });
}
