import { Command } from "commander";
import { dirname, join, resolve } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

import {
  generateGlobalsCss,
  generateTextComponent,
  generateFontCss,
  generatePaletteCss,
  generateShadowCss,
  generateGridCss,
  generateTypographyCss,
} from "./actions";
import {
  componentOutputDirPrompt,
  createTextPrompt,
  errorPrompt,
  inputDirPrompt,
  outputDirPrompt,
  successTextPrompt,
  successThemePrompt,
} from "./prompts";

const program = new Command();

program
  .version("1.0.0")
  .description("A CLI to convert Figma design tokens to a Tailwind CSS theme")
  .argument("[inputDir]", "Path to the input JSON file")
  .option(
    "-co --component-output [componentOutputDir]",
    "Path for the generated component",
  )
  .option("-o, --output [outputDir]", "Path for the CSS output directory")
  .option(
    "-t, --create-text [boolean]",
    "Flag for creating a React-based Text component",
  )
  .action(async (inputDirArg, options) => {
    try {
      let componentOutputDir = options.componentOutput;
      let createComponent = options.createText;
      let inputDir = inputDirArg;
      let outputDir = options.output;

      if (!inputDir) {
        const answers = await inputDirPrompt();
        inputDir = answers.inputDir;
      }

      if (!outputDir) {
        const answers = await outputDirPrompt();
        outputDir = answers.outputDir;
      }

      if (createComponent === undefined) {
        const answers = await createTextPrompt();
        createComponent = answers.createComponent;
      }

      if (createComponent && !componentOutputDir) {
        const answers = await componentOutputDirPrompt();
        componentOutputDir = answers.componentOutputDir;
      }

      const inputPath = resolve(inputDir);
      const resolvedOutputDir = resolve(outputDir);
      const stylesDir = join(resolvedOutputDir, "styles");
      const tokens = JSON.parse(readFileSync(inputPath, "utf-8"));

      if (!existsSync(inputPath)) {
        errorPrompt(`Input file not found at ${inputPath}`);
        process.exit(1);
      }

      if (!existsSync(resolvedOutputDir)) {
        mkdirSync(resolvedOutputDir, { recursive: true });
      }

      if (!existsSync(stylesDir)) {
        mkdirSync(stylesDir, { recursive: true });
      }

      writeFileSync(join(stylesDir, "font.css"), generateFontCss(tokens));
      writeFileSync(join(stylesDir, "palette.css"), generatePaletteCss(tokens));
      writeFileSync(join(stylesDir, "shadows.css"), generateShadowCss(tokens));
      writeFileSync(join(stylesDir, "spacing.css"), generateGridCss(tokens));
      writeFileSync(
        join(stylesDir, "typography.css"),
        generateTypographyCss(tokens),
      );
      writeFileSync(
        join(resolvedOutputDir, "globals.css"),
        generateGlobalsCss(createComponent ? componentOutputDir : undefined),
      );

      successThemePrompt(resolvedOutputDir);

      if (createComponent) {
        const fullComponentPath = resolve(componentOutputDir, "Text/index.tsx");

        mkdirSync(dirname(fullComponentPath), { recursive: true });
        writeFileSync(fullComponentPath, generateTextComponent(tokens));

        successTextPrompt(fullComponentPath);
      }
    } catch (error) {
      errorPrompt(error as Error);
      process.exit(1);
    }
  });

program.parse(process.argv);
