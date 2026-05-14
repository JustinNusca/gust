import { oraPromise } from "ora";

import { exitWithError, showSuccess, showWarning } from "#action/show-message";
import { figmaTokenPrompt } from "#prompt/figma-token";
import { hasStoredFigmaToken, setFigmaToken } from "#util/credentials";
import { getMe } from "#util/figma-api";

const TOKEN_PREFIX = "figd_";

export async function login(tokenArg?: string) {
  try {
    if (await hasStoredFigmaToken()) {
      showWarning("You are already logged in. Run `gust logout` first.");
      return;
    }

    let token = tokenArg?.trim();

    if (!token) {
      const answers = await figmaTokenPrompt();
      token = answers.token;
    }

    if (!token.startsWith(TOKEN_PREFIX)) {
      throw new Error(
        `That doesn't look like a Figma personal access token — it should start with \`${TOKEN_PREFIX}\`.`,
      );
    }

    console.log();
    await oraPromise(getMe(token), {
      text: "Validating access token…",
      successText: "Access token is valid!",
      failText: "Access token was rejected by Figma.",
    });

    await setFigmaToken(token);

    showSuccess("You have successfully logged in.");
  } catch (error) {
    exitWithError(error);
  }
}
