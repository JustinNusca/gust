import { Tokens } from "../types";
import { flattenTokens, sanitizeName } from "../util";

export function generateTextComponent(tokens: Tokens): string {
  const flattenedStyles = flattenTokens(tokens.font || {});
  const variants = Object.keys(flattenedStyles).map(sanitizeName).sort();
  const fallbackVariant = variants[0];
  const textVariantType = `type TextVariant =\n  | "${variants.join('"\n  | "')}";`;
  const getClassNameForVariantCases = variants
    .map((variant) => `    case "${variant}":\n      return "font-${variant}";`)
    .join("\n");

  return `import { Slot } from "@radix-ui/react-slot";
import { twMerge } from "tailwind-merge";

${textVariantType}

type TextAllowedAs = "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export type TextProps<T extends TextAllowedAs = "span"> =
  React.ComponentPropsWithoutRef<T> & {
    /**
     * A short hand for the \`asChild\` prop that accepts typical HTML text nodes.
     * For example, passing \`"p"\` will render a \`<p>\` element, without requiring
     * the additional nesting for the \`asChild\` prop.
     */
    as?: TextAllowedAs;
    /**
     * Change the default rendered element for the one passed as a child,
     * merging their props and behavior.
     *
     * For more details, see the
     * [Radix composition guide](https://www.radix-ui.com/primitives/docs/guides/composition).
     */
    asChild?: boolean;
    /**
     * Determines the rendered appearance of the component from a predefined set.
     */
    variant?: TextVariant;
  };

function getClassNameForVariant(variant: TextProps["variant"]) {
  switch (variant) {
${getClassNameForVariantCases}
    default:
      return "font-${fallbackVariant}";
  }
}

/**
 * This component renders the textual children it receives with the preset
 * typographic styles, configured by the variant prop. It renders a <span> by
 * default.
 *
 * All props are forwarded to the root element.
 */
export function Text<T extends TextAllowedAs = "span">({
  as = "span",
  asChild,
  children,
  className,
  variant = "${fallbackVariant}",
  ...otherProps
}: TextProps<T>) {
  const Comp = asChild ? Slot : as;

  return (
    <Comp
      className={twMerge(getClassNameForVariant(variant), className)}
      {...otherProps}
    >
      {children}
    </Comp>
  );
}
`;
}
