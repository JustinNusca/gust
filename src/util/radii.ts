import type { ParsedFigma } from "#action/parse-figma-response";
import type { ParsedFigmaVariable } from "#action/parse-figma-variables";
import {
  classifyVariables,
  isNumber,
  pickAliasTerminal,
  pickAliasTerminalWithFallback,
  pickVariableValue,
  pickVariableValueWithFallback,
} from "#util/figma-variables";
import {
  RADII_NAME_PATTERN,
  RADIUS_NAME_FRAGMENT_PATTERN,
} from "#util/name-patterns";
import { sanitizeName, stripNameFragments } from "#util/names";
import type {
  ResolvedTokenDomain,
  TokenEntry,
  TokenMode,
} from "#util/resolved";

export type RadiusEntry = TokenEntry;
export type RadiiMode = TokenMode<RadiusEntry>;
export type ResolvedRadii = ResolvedTokenDomain<RadiusEntry>;

/**
 * Reports whether a variable looks like a border-radius token. Figma's
 * `CORNER_RADIUS` scope is authoritative when set — the author has tagged
 * the variable for radius use. Otherwise we fall back to a name check
 * against the collection or variable name (e.g. a "Radius" or "Corners"
 * collection, or a token literally named "radius-md").
 */
function isRadiusVariable(variable: ParsedFigmaVariable): boolean {
  if (variable.resolvedType !== "FLOAT") return false;
  if (variable.scopes.includes("CORNER_RADIUS")) return true;

  return (
    RADII_NAME_PATTERN.test(variable.collection.name) ||
    RADII_NAME_PATTERN.test(variable.name)
  );
}

/**
 * Resolves a `ParsedFigma` into a writer-ready radii bundle. Mirrors the
 * `resolvePalette` shape: core (primitive) tokens go to `core[]`, semantic
 * tokens go into a `modes[]` array (default mode first, then one entry per
 * additional mode with at least one value). Semantic values are rewritten to
 * `var(--core-{name})` when they alias into a core variable (or, failing
 * that, when their value matches a core entry) so primitives can change in
 * one place.
 *
 * Core entries come from two sources: variables in a `kind: "core"` radius
 * collection, and the alias terminals of semantic radii that point into any
 * `kind: "core"` FLOAT collection. The second source handles the common
 * "shared primitive scale" pattern (e.g. one `Primitive-scale` collection
 * referenced by `Semantic-corner-radius`, `Semantic-spacing`, etc.) where
 * the source primitive isn't named after any domain.
 *
 * Entries are sorted by numeric `px` value within each bucket — the writer
 * can no longer sort on its own once values become `var(...)` references.
 */
export function resolveRadii(parsed: ParsedFigma): ResolvedRadii {
  const { default: defaultMode, others } = parsed.themes;
  const { core, semantic } = classifyVariables(
    parsed.variables,
    isRadiusVariable,
  );

  const coreSortable: { name: string; num: number }[] = [];
  const coreByName = new Set<string>();
  const coreByValue = new Map<string, string>();

  const hoistCore = (name: string, num: number) => {
    if (coreByName.has(name)) return;
    coreByName.add(name);
    coreSortable.push({ name, num });
    const formatted = `${num}px`;
    if (!coreByValue.has(formatted)) coreByValue.set(formatted, name);
  };

  for (const [tokenName, variable] of core) {
    const num = pickVariableValueWithFallback(variable, defaultMode, isNumber);
    if (num === null) continue;
    hoistCore(tokenName, num);
  }

  for (const [, variable] of semantic) {
    const terminals = new Set<string>();
    const defaultTerminal = pickAliasTerminalWithFallback(
      variable,
      defaultMode,
    );
    if (defaultTerminal) terminals.add(defaultTerminal);
    for (const mode of others) {
      const t = pickAliasTerminal(variable, mode);
      if (t) terminals.add(t);
    }
    for (const terminalName of terminals) {
      const target = parsed.variables[terminalName];
      if (!target) continue;
      if (target.kind !== "core") continue;
      if (target.resolvedType !== "FLOAT") continue;
      const num = pickVariableValueWithFallback(target, defaultMode, isNumber);
      if (num === null) continue;
      hoistCore(terminalName, num);
    }
  }

  coreSortable.sort((a, b) => a.num - b.num);
  const coreEntries: RadiusEntry[] = coreSortable.map(({ name, num }) => ({
    name,
    value: `${num}px`,
  }));

  const renderSemantic = (
    variable: ParsedFigmaVariable,
    modeName: string,
    num: number,
    fallbackMode: boolean,
  ): string => {
    const terminal = fallbackMode
      ? pickAliasTerminalWithFallback(variable, modeName)
      : pickAliasTerminal(variable, modeName);
    if (terminal && coreByName.has(terminal)) return `var(--core-${terminal})`;
    const formatted = `${num}px`;
    const matched = coreByValue.get(formatted);
    return matched ? `var(--core-${matched})` : formatted;
  };

  const buildSemanticEntries = (
    pick: (variable: ParsedFigmaVariable) => number | null,
    modeName: string,
    fallbackMode: boolean,
  ): RadiusEntry[] => {
    const buffer: { name: string; num: number; value: string }[] = [];
    for (const [tokenName, variable] of semantic) {
      const num = pick(variable);
      if (num === null) continue;
      buffer.push({
        name: tokenName,
        num,
        value: renderSemantic(variable, modeName, num, fallbackMode),
      });
    }
    buffer.sort((a, b) => a.num - b.num);
    return buffer.map(({ name, value }) => ({ name, value }));
  };

  const modes: RadiiMode[] = [
    {
      name: defaultMode,
      isDefault: true,
      entries: buildSemanticEntries(
        (v) => pickVariableValueWithFallback(v, defaultMode, isNumber),
        defaultMode,
        true,
      ),
    },
  ];

  for (const mode of others) {
    const entries = buildSemanticEntries(
      (v) => pickVariableValue(v, mode, isNumber),
      mode,
      false,
    );
    if (entries.length === 0) continue;
    modes.push({ name: sanitizeName(mode), isDefault: false, entries });
  }

  return {
    isEmpty:
      coreEntries.length === 0 &&
      modes.every((mode) => mode.entries.length === 0),
    core: coreEntries,
    modes,
  };
}

/**
 * Strips radius-domain fragments (`corner`, `rounding`, `radius`, `radii`)
 * from a sanitized token name so that source names like `corner-radius-xs`
 * collapse to `xs` before being prefixed with `radius-` in the CSS output.
 */
export function stripRadiusNameFragments(name: string): string {
  return stripNameFragments(name, RADIUS_NAME_FRAGMENT_PATTERN);
}
