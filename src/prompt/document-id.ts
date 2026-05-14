import { input } from "@inquirer/prompts";
import chalk from "chalk";

export async function documentIDPrompt() {
  console.log();
  console.log(
    chalk.bold("Enter the ID of the document to generate a theme for."),
  );
  console.log(
    chalk.italic(
      "This can be retrieved from the URL of the document in Figma, EG: ",
    ),
  );
  console.log(
    chalk.cyan(
      `https://www.figma.com/:file_type/${chalk.yellow(":file_ID")}/:file_name`,
    ),
  );
  console.log();

  const documentID = await input({
    message: "Document ID",
    validate: (value) =>
      value.trim().length > 0 || "A Figma document ID is required.",
  });

  return { documentID: documentID.trim() };
}
