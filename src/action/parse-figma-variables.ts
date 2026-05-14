import type { LocalVariable } from "@figma/rest-api-spec";

import type { FigmaResources } from "#util/figma-api";
import {
  classifyCollections,
  deriveThemes,
  isWireframeCollection,
  type PaletteKind,
  type ParsedThemes,
  resolveAliasTerminal,
  resolveValue,
  type VariableValue,
} from "#util/figma-variables";
import { sanitizeName } from "#util/names";

export interface ParsedFigmaVariable {
  name: string;
  id: string;
  key: string;
  resolvedType: LocalVariable["resolvedType"];
  scopes: LocalVariable["scopes"];
  collection: { id: string; name: string };
  valuesByMode: { [modeName: string]: VariableValue };
  /**
   * For each mode, the sanitized name of the variable at the end of the
   * alias chain (the variable whose own value is the concrete scalar). Null
   * when the value wasn't an alias, when the chain target is missing, or on
   * a cycle. Lets resolvers walk into a referenced core variable even
   * though `valuesByMode` has been flattened to scalars at parse time.
   */
  aliasesByMode: { [modeName: string]: string | null };
  /**
   * Palette classification for the variable's containing collection. Derived
   * once per collection by `classifyCollections` (multi-mode → semantic,
   * core-name pattern → core, otherwise alias-ratio wins). Non-COLOR variables
   * still carry a kind; downstream palette code filters on `resolvedType`.
   */
  kind: PaletteKind;
}

export type ParsedFigmaVariables = Record<string, ParsedFigmaVariable>;

export interface ParseFigmaVariablesResult {
  parsed: ParsedFigmaVariables;
  skippedRemoteCollections: Set<string>;
  themes: ParsedThemes;
}

export function parseFigmaVariables(
  resources: FigmaResources,
): ParseFigmaVariablesResult {
  const parsed: ParsedFigmaVariables = {};
  const skippedRemoteCollections = new Set<string>();
  const { variables, variableCollections } = resources.variables.meta;
  const collectionKinds = classifyCollections({
    variables,
    variableCollections,
  });

  Object.values(variables).forEach(
    ({
      variableCollectionId,
      id,
      key,
      name,
      resolvedType,
      scopes,
      valuesByMode: variableValuesByMode,
    }) => {
      const collection = variableCollections[variableCollectionId];

      if (collection.remote) {
        skippedRemoteCollections.add(collection.name);
        return;
      }

      if (isWireframeCollection(collection.name)) return;

      const aliasesByMode: { [modeName: string]: string | null } = {};
      const valuesByMode: { [modeName: string]: VariableValue } = {};
      const modeNamesById = Object.fromEntries(
        collection.modes.map(({ modeId, name }) => [modeId, name]),
      );

      Object.entries(variableValuesByMode).forEach(([modeId, rawValue]) => {
        const sourceModeName = modeNamesById[modeId];
        const resolveOptions = {
          sourceModeName,
          variableCollections,
          variables,
        };

        valuesByMode[sourceModeName] = resolveValue(rawValue, resolveOptions);
        const terminalId = resolveAliasTerminal(rawValue, resolveOptions);
        const terminalName = terminalId
          ? sanitizeName(variables[terminalId]?.name ?? "")
          : "";
        aliasesByMode[sourceModeName] = terminalName || null;
      });

      parsed[sanitizeName(name)] = {
        aliasesByMode,
        collection: { id: collection.id, name: collection.name },
        id: id,
        key: key,
        kind: collectionKinds.get(collection.id) ?? "semantic",
        name: name,
        resolvedType: resolvedType,
        scopes: scopes,
        valuesByMode,
      };
    },
  );

  const themes = deriveThemes(variableCollections);

  return { parsed, skippedRemoteCollections, themes };
}
