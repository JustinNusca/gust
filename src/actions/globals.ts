export function generateGlobalsCss(componentOutputDir?: string): string {
  return (
    '@import "tailwindcss";\n\n' +
    '@import "./styles/font.css";\n' +
    '@import "./styles/palette.css";\n' +
    '@import "./styles/shadows.css";\n' +
    '@import "./styles/spacing.css";\n' +
    '@import "./styles/typography.css";\n\n' +
    `${componentOutputDir ? `@source "${componentOutputDir}";\n\n` : ""}` +
    '@layer base {\n  * {\n    @apply antialiased;\n  }\n\n  button:not(:disabled),\n  select:not(:disabled),\n  [role="button"] {\n    @apply cursor-pointer;\n  }\n}'
  );
}
