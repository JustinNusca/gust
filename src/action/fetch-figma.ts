import { oraPromise } from "ora";

import { saveFigmaSnapshot } from "#action/debug";
import { showDebug } from "#action/show-message";
import { fetchFigmaResources } from "#util/figma-api";

export async function fetchFigma(documentId: string, debug = false) {
  console.log();
  const fetchedResults = await oraPromise(fetchFigmaResources(documentId), {
    text: "Getting resources from Figma…",
    successText: "Figma resources fetched!",
    failText: "Failed to fetch from Figma!",
  });

  const styleCount = fetchedResults.styles.length;
  const variableCount = Object.keys(
    fetchedResults.variables.meta.variables,
  ).length;
  const collectionCount = Object.keys(
    fetchedResults.variables.meta.variableCollections,
  ).length;
  const nodeCount = Object.keys(fetchedResults.nodes).length;

  showDebug(
    `${styleCount} styles (${nodeCount} resolved nodes), ${variableCount} variables across ${collectionCount} collections.`,
  );

  if (debug) {
    await saveFigmaSnapshot(fetchedResults);
  }

  return fetchedResults;
}
