import chalk from "chalk";
import { mkdirSync } from "fs";
import { join, resolve } from "path";

import { saveResolvedThemeDomain } from "#action/debug";
import type { ParsedFigma } from "#action/parse-figma-response";
import { showWarnings } from "#action/show-message";
import { writeEffectsCss } from "#action/write-effects-css";
import { writeFontsCss } from "#action/write-fonts-css";
import { writeGlobalCss } from "#action/write-global-css";
import { writeGradientsCss } from "#action/write-gradients-css";
import { writeGridCss } from "#action/write-grid-css";
import { writePaletteCss } from "#action/write-palette-css";
import { writeRadiiCss } from "#action/write-radii-css";
import { writeTypographyCss } from "#action/write-typography-css";
import { collectFlaggedNames } from "#util/css-domain";
import { resolveEffects, stripShadowNameFragments } from "#util/effects";
import { resolveFallbackPalette } from "#util/fallback-palette";
import { resolveUnaccountableFillStyles } from "#util/figma-styles";
import { resolveFonts } from "#util/fonts";
import { resolveGradients, stripGradientNameFragments } from "#util/gradients";
import { resolveGrid } from "#util/grid";
import { withUniqueCssNames } from "#util/names";
import { type ResolvedPalette, resolvePalette } from "#util/palette";
import { resolveRadii } from "#util/radii";
import { isEmpty, ResolvedDomain } from "#util/resolved";
import { resolveTypography } from "#util/typography";

type DomainKey =
  | "effects"
  | "fonts"
  | "gradients"
  | "grid"
  | "radii"
  | "typography"
  | "palette";

interface DomainContext {
  outputDir: string;
  paletteVariables: ResolvedPalette;
  parsed: ParsedFigma;
  tasks: Promise<unknown>[];
}

/**
 * One line-list of strings as passed to `showWarning(...lines)`. Domain
 * processors return these instead of firing `showWarning` directly so the
 * orchestrator can render every warning together after the resolution pass
 * — keeps domain output grouped at the end of the run rather than
 * interleaved with whatever was being logged mid-iteration.
 */
type WarningMessage = string[];

interface ThemeDomainEntry {
  key: DomainKey;
  emptyMsg: string[];
  /**
   * Resolves the domain, queues its write task into `ctx.tasks` when
   * applicable, and returns the resolved value, whether it was empty, and
   * any warning messages the orchestrator should render at the end.
   *
   * Each row owns its full lifecycle so per-domain `R` types stay internal
   * — the array stays a uniform `ThemeDomainEntry[]` without per-row
   * generics, union types, or factory helpers.
   */
  process: (ctx: DomainContext) => {
    empty: boolean;
    resolved: ResolvedDomain;
    warnings?: WarningMessage[];
  };
}

const themeDomains: ThemeDomainEntry[] = [
  {
    key: "palette",
    emptyMsg: ["No palette tokens found; skipping palette.css."],
    process: ({ parsed, paletteVariables, outputDir, tasks }) => {
      const usingFallbackPalette = isEmpty(paletteVariables);
      const resolved = usingFallbackPalette
        ? resolveFallbackPalette(parsed)
        : paletteVariables;
      const empty = isEmpty(resolved);
      const warnings: WarningMessage[] = [];

      if (!empty) {
        tasks.push(writePaletteCss(resolved, outputDir));
      }

      if (!usingFallbackPalette) {
        const { local = [], remote = [] } = resolveUnaccountableFillStyles(
          parsed,
          paletteVariables,
        );

        if (local.length > 0) {
          warnings.push([
            "Local fill styles that do not use core or semantic color tokens were found:",
            chalk.cyan(local.join(", ")),
            "Because palette variables have been defined, these colors aren't included in the generated palette.",
            "Consider replacing them with color variables in Figma.",
          ]);
        }

        if (remote.length > 0) {
          warnings.push([
            "Remote library fill styles that do not use core or semantic color tokens were found:",
            chalk.cyan(remote.join(", ")),
            "Because palette variables have been defined, these colors aren't included in the generated palette.",
            "This is often caused by unintentional use of a remote library's color styles.",
            "Consider replacing these library references with local variables, or detaching them in Figma.",
          ]);
        }
      }

      if (usingFallbackPalette && !empty) {
        warnings.push([
          "No color variables found! Ensure your Figma file has local variables defined.",
          "Variables are the recommended way to define a palette in Figma; they support modes, aliasing, and stable references across files.",
          "You can add them in Figma's “Design mode”, by pressing the “Variable settings” icon in the right-side panel.",
        ]);
        warnings.push([
          "Palette tokens were generated from document styles instead.",
          "This is a best-effort fallback: every fill style becomes a flat core token, with no semantic layer and no theme modes (e.g. light/dark).",
          "Consider redefining these colors as variables in Figma.",
        ]);
      }

      const nonCoreNames = collectFlaggedNames({
        entries: resolved.modes.flatMap((mode) => mode.entries),
        valueFor: ({ value }) => value,
        nameFor: ({ name }) => `--color-${name}`,
        flag: (value) => value.includes("rgba("),
      });
      if (nonCoreNames.length > 0) {
        warnings.push([
          "Semantic palette variables that do not use core color tokens were found:",
          chalk.cyan(nonCoreNames.join(", ")),
          "This can cause problems with consistency and maintainability, especially when updating core palette colors.",
          "Consider updating the 'semantic' variable in Figma to reference a variable from a 'core' variable collection.",
        ]);
      }

      return { resolved, empty, warnings };
    },
  },
  {
    key: "radii",
    emptyMsg: ["No radii tokens found; skipping radii.css."],
    process: ({ parsed, outputDir, tasks }) => {
      const resolved = resolveRadii(parsed);
      const empty = isEmpty(resolved);

      if (!empty) {
        tasks.push(writeRadiiCss(resolved, outputDir));
      }

      return { resolved, empty };
    },
  },
  {
    key: "effects",
    emptyMsg: ["No shadow or blur effect styles found; skipping effects.css."],
    process: ({ parsed, paletteVariables, outputDir, tasks }) => {
      const resolved = resolveEffects(parsed, paletteVariables);
      const empty = isEmpty(resolved);
      const warnings: WarningMessage[] = [];

      if (!empty) {
        tasks.push(writeEffectsCss(resolved, outputDir));
      }

      const { warnings: skipped } = resolved;

      if (skipped.progressiveBlur.length > 0) {
        warnings.push([
          "Found progressive blur effect styles:",
          chalk.cyan(skipped.progressiveBlur.join(", ")),
          "Progressive blur effects have no native CSS equivalent; devs must implement these manually.",
        ]);
      }
      if (skipped.noise.length > 0) {
        warnings.push([
          "Found noise effect styles:",
          chalk.cyan(skipped.noise.join(", ")),
          "Noise effects have no native CSS equivalent; devs must implement these manually.",
        ]);
      }
      if (skipped.texture.length > 0) {
        warnings.push([
          "Found texture effect styles:",
          chalk.cyan(skipped.texture.join(", ")),
          "Texture effects have no native CSS equivalent; devs must implement these manually.",
        ]);
      }
      if (skipped.glass.length > 0) {
        warnings.push([
          "Found glass effect styles:",
          chalk.cyan(skipped.glass.join(", ")),
          "Glass effects have no native CSS equivalent; devs must implement these manually.",
        ]);
      }
      if (skipped.remote.length > 0) {
        warnings.push([
          "Remote library effect styles were found:",
          chalk.cyan(skipped.remote.join(", ")),
          "These aren't included in the generated effects.css.",
          "This is often caused by unintentional use of a remote library's effect styles.",
          "Consider redefining them as local effect styles in Figma, or removing them from any layers that reference them.",
        ]);
      }

      const nonSemanticNames = collectFlaggedNames({
        entries: withUniqueCssNames(
          resolved.themed.shadows,
          stripShadowNameFragments,
        ),
        valueFor: ({ value }) => value,
        nameFor: ({ cssName }) => `--shadow-${cssName}`,
      });
      if (nonSemanticNames.length > 0) {
        warnings.push([
          "Shadow tokens that do not use semantic palette values were found:",
          chalk.cyan(nonSemanticNames.join(", ")),
          "This may cause issues when working with multiple themes (eg, light and dark).",
          "Consider updating the Effect style in Figma to use a semantic color variable.",
        ]);
      }

      return { resolved, empty, warnings };
    },
  },
  {
    key: "gradients",
    emptyMsg: ["No gradient tokens found; skipping gradients.css."],
    process: ({ parsed, paletteVariables, outputDir, tasks }) => {
      const resolved = resolveGradients(parsed, paletteVariables);
      const empty = isEmpty(resolved);
      const warnings: WarningMessage[] = [];

      if (!empty) {
        tasks.push(writeGradientsCss(resolved, outputDir));
      }

      const nonSemanticNames = collectFlaggedNames({
        entries: withUniqueCssNames(
          resolved.entries,
          stripGradientNameFragments,
        ),
        valueFor: ({ value }) => value,
        nameFor: ({ cssName }) => `bg-gradient-${cssName}`,
      });
      if (nonSemanticNames.length > 0) {
        warnings.push([
          "Gradient utilities that do not use semantic palette values were found:",
          chalk.cyan(nonSemanticNames.join(", ")),
          "This may cause issues when working with multiple themes (eg, light and dark).",
          "Consider updating the Color style in Figma to use semantic color variables.",
        ]);
      }

      return { resolved, empty, warnings };
    },
  },
  {
    key: "fonts",
    emptyMsg: ["No font styles found; skipping fonts.css."],
    process: ({ parsed, outputDir, tasks }) => {
      const resolved = resolveFonts(parsed);
      const empty = isEmpty(resolved);

      if (!empty) {
        tasks.push(writeFontsCss(resolved, outputDir));
      }

      return { resolved, empty };
    },
  },
  {
    key: "typography",
    emptyMsg: [
      "No text styles found in file library!",
      "Ensure your Figma file has text styles in a published library.",
      `Learn more about publishing libraries at ${chalk.cyanBright("https://help.figma.com/hc/en-us/articles/360039957034-Create-and-apply-text-styles")}`,
    ],
    process: ({ parsed, outputDir, tasks }) => {
      const resolved = resolveTypography(parsed);

      const empty = isEmpty(resolved);
      if (!empty) {
        tasks.push(writeTypographyCss(resolved, outputDir));
      }

      return { resolved, empty };
    },
  },
  {
    key: "grid",
    emptyMsg: ["No grid styles found; skipping grid.css."],
    process: ({ parsed, outputDir, tasks }) => {
      const resolved = resolveGrid(parsed);
      const empty = isEmpty(resolved);

      if (!empty) {
        tasks.push(writeGridCss(resolved, outputDir));
      }

      return { resolved, empty };
    },
  },
];

export async function generateTailwindTheme(
  parsed: ParsedFigma,
  outputDir: string,
  componentOutputDir?: string,
  debug = false,
): Promise<void> {
  const resolvedOutputDir = resolve(outputDir);
  const themeDir = join(resolvedOutputDir, "theme");
  const paletteVariables = resolvePalette(parsed);
  const tasks: Promise<unknown>[] = [];
  const present = new Set<DomainKey>();
  const collectedWarnings: WarningMessage[] = [];

  mkdirSync(themeDir, { recursive: true });

  themeDomains.forEach(({ emptyMsg, process, key }) => {
    const { resolved, empty, warnings } = process({
      outputDir: resolvedOutputDir,
      paletteVariables,
      parsed,
      tasks,
    });

    if (debug) {
      tasks.push(saveResolvedThemeDomain(resolved, key));
    }

    if (warnings) {
      collectedWarnings.push(...warnings);
    }

    if (empty) {
      collectedWarnings.push(emptyMsg);
    }

    if (!empty) present.add(key);
  });

  tasks.push(
    writeGlobalCss(resolvedOutputDir, {
      componentOutputDir,
      hasEffects: present.has("effects"),
      hasFonts: present.has("fonts"),
      hasGradients: present.has("gradients"),
      hasGrid: present.has("grid"),
      hasPalette: present.has("palette"),
      hasRadii: present.has("radii"),
      hasTypography: present.has("typography"),
    }),
  );

  await Promise.all(tasks);

  showWarnings(collectedWarnings);
}
