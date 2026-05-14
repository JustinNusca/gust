import { password } from "@inquirer/prompts";
import chalk from "chalk";

export async function figmaTokenPrompt() {
  console.log();
  console.log(chalk.bold("Enter your Figma personal access token."));
  console.log(
    chalk.italic(
      'Generate one from Figma under Settings → Security → "Personal access tokens", EG: ',
    ),
  );
  console.log(chalk.cyan("https://www.figma.com/settings"));
  console.log();

  const token = await password({
    message: "Access token",
    mask: "*",
    validate: (value) =>
      value.trim().length > 0 || "An access token is required.",
  });

  return { token: token.trim() };
}
