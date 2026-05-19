// Token-name and name-fragment regexes for each domain resolver. Each domain
// defines two flavors:
//
// - **`*_NAME_PATTERN`**: Used to *detect* whether a token belongs to the
//   domain (e.g. "is this collection a radii collection?", "is this style a
//   shadow?").
// - **`*_FRAGMENT_PATTERN`**: Used used to *strip* domain words from a
//   sanitized name (e.g. `shadow-card-primary` → `card-primary`) via
//   `stripNameFragments`.

export const RADII_NAME_PATTERN = /\b(radius|radii|corners?|rounding)\b/i;
export const RADIUS_NAME_FRAGMENT_PATTERN =
  /^(corners?|rounding|radius|radii)$/i;

export const SHADOW_NAME_PATTERN = /shadow|glow|elevation/i;
export const SHADOW_NAME_FRAGMENT_PATTERN =
  /^(drop|shadows?|dropshadows?|elevations?)$/i;
export const BLUR_NAME_FRAGMENT_PATTERN =
  /^(blurs?|filter|backdrop|background|layer|effects?)$/i;

export const GRADIENT_NAME_PATTERN = /gradient/i;
export const GRADIENT_NAME_FRAGMENT_PATTERN = /^(gradients?|bg|backgrounds?)$/i;

export const GRID_NAME_FRAGMENT_PATTERN = /^(grids?|layouts?|columns?|rows?)$/i;

export const TYPOGRAPHY_NAME_FRAGMENT_PATTERN =
  /^(typography|text|type|font)$/i;
