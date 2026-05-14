import { fetchFigma } from "#action/fetch-figma";
import { documentIDPrompt } from "#prompt/document-id";
import { outputDirPrompt } from "#prompt/output-dir";

import { generateTailwindTheme } from "./generate-tailwind-theme.js";
import { parseFigmaResponse } from "./parse-figma-response.js";
import { exitWithError } from "./show-message.js";

export interface WizardOptions {
  output?: string;
  componentOutput?: string;
  createText?: boolean;
  debug?: boolean;
}

export async function runWizard(
  documentIdArg: string | undefined,
  options: WizardOptions,
) {
  try {
    const componentOutputDir = options.componentOutput;
    let outputDir = options.output;
    let documentId = documentIdArg;

    if (!documentId) {
      const answers = await documentIDPrompt();
      documentId = answers.documentID;
    }

    if (!outputDir) {
      const answers = await outputDirPrompt();
      outputDir = answers.outputDir;
    }

    // TODO: Implment actions for creating primitive components from tokens
    // (ie, a `Text` component).
    //
    // const createComponent = options.createText;
    // if (createComponent === undefined) {
    //   const answers = await createTextPrompt();
    //   createComponent = answers.createComponent;
    // }

    // if (createComponent && !componentOutputDir) {
    //   const answers = await componentOutputDirPrompt();
    //   componentOutputDir = answers.componentOutputDir;
    // }

    const debug = options.debug ?? false;
    const fetchedResults = await fetchFigma(documentId, debug);
    const parsed = await parseFigmaResponse(fetchedResults, debug);

    await generateTailwindTheme(parsed, outputDir, componentOutputDir, debug);
  } catch (error) {
    exitWithError(error);
  }
}
