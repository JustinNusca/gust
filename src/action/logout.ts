import { exitWithError, showSuccess, showWarning } from "#action/show-message";
import { deleteFigmaToken } from "#util/credentials";

export async function logout() {
  try {
    const removed = await deleteFigmaToken();

    if (removed) {
      showSuccess("You have successfully logged out.");
    } else {
      showWarning("No existing token was found. Please try logging in.");
    }
  } catch (error) {
    exitWithError(error);
  }
}
