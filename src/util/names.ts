export function deduplicateName(name: string): string {
  const parts = name.split("-");

  return parts
    .reduce(
      (acc, part) => (!acc.includes(part) ? [...acc, part] : acc),
      [] as string[],
    )
    .join("-");
}
export function sanitizeName(name: string) {
  return deduplicateName(
    name
      // Add hyphen before uppercase letters.
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      // Replace "synonyms" for 'color' with 'color'.
      // This removes differences in spelling and helps keep names shorter.
      .replace(/(colour|palette)/g, "color")
      // Remove the 's' from the end of commonly used "theme" words.
      // This removes unnecessary plurals and helps keep names shorter.
      .replace(
        /\b(color|gradient|token|font|border|shadow|spacing|size|background|text|surface|neutral|accent)s\b/gi,
        "$1",
      )
      // Replace non-alphanumeric characters with hyphen.
      .replace(/[^a-zA-Z0-9]/g, "-")
      // Replace repeated hyphens with a single instance.
      .replace(/-+/g, "-")
      // Remove leading or trailing hyphens.
      .replace(/(-+)$|^(-+)/g, "")
      .toLowerCase(),
  );
}

export function getCssVariableName(name: string, prefix = ""): string {
  return `var(--${sanitizeName(`${prefix}${prefix ? "-" : ""}${name}`)})`;
}
