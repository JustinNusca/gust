import type {
  LocalVariable,
  LocalVariableCollection,
  RGB,
  RGBA,
  VariableAlias,
} from "@figma/rest-api-spec";

import type {
  ParsedFigmaVariable,
  ParsedFigmaVariables,
} from "#action/parse-figma-variables";

export type VariableValue = LocalVariable["valuesByMode"][string];

export type PaletteKind = "core" | "semantic";

const CORE_COLLECTION_NAME_PATTERN =
  /\b(base|cores?|primitives?|foundations?|raw)\b/i;
const SEMANTIC_COLLECTION_NAME_PATTERN = /\b(semantics?|themes?|aliased?)\b/i;
const WIREFRAME_COLLECTION_NAME_PATTERN = /\bwireframes?\b/i;

/**
 * Given a collection name, determines if it represents a "wireframe"
 * collection (IE, variables used for low-fidelity mocks that should not be
 * emitted as part of the generated theme)
 */
export function isWireframeCollection(
  collectionName: string | undefined,
): boolean {
  if (collectionName === undefined) return false;
  return WIREFRAME_COLLECTION_NAME_PATTERN.test(collectionName);
}

/**
 * Type guard narrowing an arbitrary variable value to an `RGB`/`RGBA` color
 * object. Non-color variable values (numbers, booleans, strings, unresolved
 * aliases) return `false`.
 */
export const isRgb = (value: unknown): value is RGB | RGBA =>
  typeof value === "object" &&
  value !== null &&
  "r" in value &&
  "g" in value &&
  "b" in value;

/**
 * Type guard narrowing an arbitrary variable value to a `number`. Pair with
 * `pickVariableValue` to read numeric tokens (e.g. radii, spacing) while
 * skipping unresolved aliases and other non-number values.
 */
export const isNumber = (value: unknown): value is number =>
  typeof value === "number";

/**
 * Reads a variable's value for a specific mode, narrowing through `guard` to
 * the caller's expected type. Returns `null` when the mode isn't present on
 * the variable or the value fails the guard (e.g. an unresolved alias).
 */
export function pickVariableValue<T>(
  variable: ParsedFigmaVariable,
  modeName: string,
  guard: (value: unknown) => value is T,
): T | null {
  const value = variable.valuesByMode[modeName];
  return guard(value) ? value : null;
}

/**
 * Reads a variable's value for `defaultMode`, falling back to the first value
 * on the variable that satisfies `guard` when the default mode is missing.
 * Used to give mode-agnostic outputs (e.g. core tokens, default-theme entries)
 * a value even when the variable's own collection doesn't carry the default
 * mode's name.
 */
export function pickVariableValueWithFallback<T>(
  variable: ParsedFigmaVariable,
  defaultMode: string,
  guard: (value: unknown) => value is T,
): T | null {
  const direct = pickVariableValue(variable, defaultMode, guard);
  if (direct !== null) return direct;
  for (const value of Object.values(variable.valuesByMode)) {
    if (guard(value)) return value;
  }
  return null;
}

export interface ClassifiedVariables {
  core: [string, ParsedFigmaVariable][];
  semantic: [string, ParsedFigmaVariable][];
}

/**
 * Partitions `variables` into `core` and `semantic` buckets via each
 * variable's precomputed `kind` (set by `classifyCollections` at parse
 * time). `predicate` selects which variables belong to the calling domain
 * — e.g. `(v) => v.resolvedType === "COLOR"` for palette, or a radius-
 * recognizing check for radii. Preserves iteration order within each
 * bucket so downstream emits stay deterministic.
 */
export function classifyVariables(
  variables: ParsedFigmaVariables,
  predicate: (variable: ParsedFigmaVariable) => boolean,
): ClassifiedVariables {
  const core: [string, ParsedFigmaVariable][] = [];
  const semantic: [string, ParsedFigmaVariable][] = [];
  for (const entry of Object.entries(variables)) {
    if (!predicate(entry[1])) continue;
    (entry[1].kind === "core" ? core : semantic).push(entry);
  }
  return { core, semantic };
}

export interface ClassifyCollectionsInput {
  variables: Record<string, LocalVariable>;
  variableCollections: Record<string, LocalVariableCollection>;
}

/**
 * Classifies each local, non-wireframe variable collection as "core"
 * (primitives) or "semantic" (theme aliases). Signals, in order from
 * strongest to weakest:
 *
 *  1. **Multi-mode** → "semantic". A collection with more than one mode is a
 *     theme layer by construction (light/dark, brand A/B); primitives are
 *     mode-agnostic.
 *  2. **Semantic name pattern** → "semantic" when the collection name matches
 *     `SEMANTIC_COLLECTION_NAME_PATTERN` (e.g. "Semantic", "Theme",
 *     "Aliases"). Catches single-mode semantic layers that the alias-ratio
 *     fallback would otherwise misread.
 *  3. **Core name pattern** → "core" when the collection name matches
 *     `CORE_COLLECTION_NAME_PATTERN` (e.g. "Base", "Core", "Primitives").
 *     Preserved as an explicit author cue.
 *  4. **Alias ratio** → counts each variable's default-mode value as either
 *     an alias or a raw value (any non-alias); when aliases outnumber raws
 *     the collection is "semantic", otherwise "core".
 *
 * Wireframe and remote collections are omitted from the result.
 */
export function classifyCollections(
  input: ClassifyCollectionsInput,
): Map<string, PaletteKind> {
  const result = new Map<string, PaletteKind>();

  for (const collection of Object.values(input.variableCollections)) {
    if (collection.remote) continue;
    if (isWireframeCollection(collection.name)) continue;

    if (collection.modes.length > 1) {
      result.set(collection.id, "semantic");
      continue;
    }

    if (SEMANTIC_COLLECTION_NAME_PATTERN.test(collection.name)) {
      result.set(collection.id, "semantic");
      continue;
    }

    if (CORE_COLLECTION_NAME_PATTERN.test(collection.name)) {
      result.set(collection.id, "core");
      continue;
    }

    let rawCount = 0;
    let aliasCount = 0;

    Object.values(input.variables).forEach((variable) => {
      if (variable.variableCollectionId !== collection.id) return;

      const value = variable.valuesByMode[collection.defaultModeId];

      if (isAlias(value)) {
        aliasCount += 1;
      } else if (value !== undefined) {
        rawCount += 1;
      }
    });

    result.set(collection.id, aliasCount > rawCount ? "semantic" : "core");
  }

  return result;
}

/**
 * Type guard for `VARIABLE_ALIAS` entries inside a variable's `valuesByMode`.
 */
export function isAlias(value: VariableValue): value is VariableAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "VARIABLE_ALIAS"
  );
}

export interface ResolveValueOptions {
  sourceModeName: string;
  variables: Record<string, LocalVariable>;
  variableCollections: Record<string, LocalVariableCollection>;
  visited?: Set<string>;
}

/**
 * Recursively walks `VARIABLE_ALIAS` references until a concrete value is
 * reached. Non-alias values are returned as-is. When the alias target lives
 * in another collection, the mode is matched by name (e.g. "Light" →
 * "Light"), falling back to the target collection's default mode when no
 * name match exists. Cycles are detected via the `visited` set; on a cycle
 * or a missing target, the unresolved alias is returned as-is.
 */
export function resolveValue(
  value: VariableValue,
  options: ResolveValueOptions,
): VariableValue {
  const {
    sourceModeName,
    variables,
    variableCollections,
    visited = new Set(),
  } = options;

  if (!isAlias(value)) return value;
  if (visited.has(value.id)) return value;

  const target = variables[value.id];
  if (!target) return value;

  const targetCollection = variableCollections[target.variableCollectionId];
  const matchingMode = targetCollection.modes.find(
    ({ name }) => name === sourceModeName,
  );
  const targetModeId = matchingMode?.modeId ?? targetCollection.defaultModeId;
  const targetValue = target.valuesByMode[targetModeId];

  return resolveValue(targetValue, {
    sourceModeName,
    variables,
    variableCollections,
    visited: new Set([...visited, value.id]),
  });
}

/**
 * Walks `VARIABLE_ALIAS` references until reaching a non-alias value. Returns
 * the ID of the variable that *holds* that scalar — the last variable in the
 * alias chain, whose own `valuesByMode` entry is the concrete value. Returns
 * null when `value` isn't an alias, when the target is missing, or on a
 * cycle. Companion to `resolveValue`: that function yields the scalar,
 * this one yields the source variable so callers can inspect its collection
 * (e.g. to decide whether to hoist it into a core token block).
 */
export function resolveAliasTerminal(
  value: VariableValue,
  options: ResolveValueOptions,
): string | null {
  const {
    sourceModeName,
    variables,
    variableCollections,
    visited = new Set(),
  } = options;

  if (!isAlias(value)) return null;
  if (visited.has(value.id)) return null;

  const target = variables[value.id];
  if (!target) return null;

  const targetCollection = variableCollections[target.variableCollectionId];
  const matchingMode = targetCollection.modes.find(
    ({ name }) => name === sourceModeName,
  );
  const targetModeId = matchingMode?.modeId ?? targetCollection.defaultModeId;
  const targetValue = target.valuesByMode[targetModeId];

  if (!isAlias(targetValue)) return value.id;

  return resolveAliasTerminal(targetValue, {
    sourceModeName,
    variables,
    variableCollections,
    visited: new Set([...visited, value.id]),
  });
}

/**
 * Reads a variable's pre-resolved alias terminal (sanitized name of the
 * source variable) for `modeName`. Returns null when the mode's value
 * wasn't an alias, or when `modeName` isn't present on the variable.
 */
export function pickAliasTerminal(
  variable: ParsedFigmaVariable,
  modeName: string,
): string | null {
  return variable.aliasesByMode[modeName] ?? null;
}

/**
 * As `pickAliasTerminal`, but falls back to the variable's first defined
 * mode when `modeName` isn't present. Mirrors the fallback semantics of
 * `pickVariableValueWithFallback` so the two lookups stay aligned on the
 * same mode.
 */
export function pickAliasTerminalWithFallback(
  variable: ParsedFigmaVariable,
  modeName: string,
): string | null {
  if (modeName in variable.aliasesByMode) {
    return variable.aliasesByMode[modeName];
  }
  const first = Object.keys(variable.aliasesByMode)[0];
  return first !== undefined ? variable.aliasesByMode[first] : null;
}

export interface ParsedThemes {
  default: string;
  others: string[];
}

/**
 * Derives a default/other-modes theme breakdown from local variable
 * collections. The first local collection with more than one mode is treated
 * as the theme collection: its default mode name becomes the default theme,
 * and the remaining mode names become non-default themes. When no multi-mode
 * collection exists, the default theme falls back to the first local
 * collection's only mode and `others` is empty.
 */
export function deriveThemes(
  variableCollections: Record<string, LocalVariableCollection>,
): ParsedThemes {
  const localCollections = Object.values(variableCollections).filter(
    (c) => !c.remote,
  );
  const themeCollection = localCollections.find((c) => c.modes.length > 1);
  if (!themeCollection) {
    const fallback = localCollections[0];
    return {
      default: fallback?.modes[0]?.name ?? "default",
      others: [],
    };
  }
  const defaultModeName =
    themeCollection.modes.find(
      (m) => m.modeId === themeCollection.defaultModeId,
    )?.name ?? themeCollection.modes[0].name;
  const others = themeCollection.modes
    .map((m) => m.name)
    .filter((name) => name !== defaultModeName);
  return { default: defaultModeName, others };
}
