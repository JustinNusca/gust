import { Entry } from "@napi-rs/keyring";

const SERVICE = "gust";
const ACCOUNT = "figma-access-token";
const ENV_VAR = "FIGMA_ACCESS_TOKEN";

function entry() {
  return new Entry(SERVICE, ACCOUNT);
}

export function setFigmaToken(token: string) {
  entry().setPassword(token);
}

export function getFigmaToken() {
  const fromEnv = process.env[ENV_VAR]?.trim();
  return fromEnv ? fromEnv : entry().getPassword();
}

export function hasStoredFigmaToken() {
  return entry().getPassword() !== null;
}

export function deleteFigmaToken() {
  return entry().deletePassword();
}
