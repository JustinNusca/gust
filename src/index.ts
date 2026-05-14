#!/usr/bin/env node
import { Command } from "commander";

import { login } from "#action/login";
import { logout } from "#action/logout";
import { runWizard } from "#action/run-wizard";

function withWizardOptions(cmd: Command) {
  return cmd
    .option("-o, --output [outputDir]", "Path for the CSS output directory")
    .option(
      "-c, --component-output [componentOutputDir]",
      "Path for the generated component output directory",
    )
    .option(
      "-t, --create-text [boolean]",
      "Flag for creating a React-based Text component",
    )
    .option(
      "--debug",
      "Save intermediate Figma data to .gust/ for debugging",
      process.env.GUST_DEBUG === "true",
    );
}

const program = new Command();

withWizardOptions(
  program
    .name("gust")
    .version("1.0.0")
    .description("A CLI to convert Figma design tokens to a Tailwind CSS theme")
    .argument(
      "[documentId]",
      "ID for the Figma document from which to generate a theme",
    ),
).action(runWizard);

withWizardOptions(
  program
    .command("wizard [documentId]")
    .description(
      "Interactive setup wizard for generating a Tailwind CSS theme from scratch",
    ),
).action(runWizard);

program
  .command("audit")
  .description(
    "Creates a report comparing existing theme tokens to ones identified in Figma",
  )
  .action(async () => {
    // TODO: implement audit
  });

program
  .command("login [token]")
  .description("Store Figma API token for fetching document details")
  .action(login);

program
  .command("logout")
  .description("Remove stored Figma API token")
  .action(logout);

program.parse(process.argv);
