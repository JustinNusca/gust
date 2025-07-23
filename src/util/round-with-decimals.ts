/**
 * If the provided value is a number, it is rounded to 2 decimal positions.
 * Otherwise it is returned as-is.
 */
export function roundWithDecimals(value?: number, decimalPlaces = 2) {
  if (value === undefined) {
    return value;
  }

  const factorOfTen = Math.pow(10, decimalPlaces || 2);
  return Math.round(value * factorOfTen) / factorOfTen;
}
