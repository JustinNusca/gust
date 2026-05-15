# Gust

As in, a burst of wind.

Gust is a simple CLI tool to generate and audit Tailwind V4 theme files from Figma design tokens and documents.

![Example GIF](./.github/example.gif)

> [!WARNING]
> This is a simple static tool that outputs a highly-opinionated structure for the CSS files and components it generates.
>
> It does not implement the full specifications of tokens that Figma may export, and may not catch tokens that do not follow the expected format.
>
> It is expected that you modify the output as needed after generation.
>
> I mostly made this for myself to avoid repetitive boilerplate when scaffolding a new application. Your mileage may vary.

## Setup

After cloning this repository, install the relevant dependencies. This project uses [pnpm](https://pnpm.io/installation) as its package manager, and is built with Node.JS and Typescript.

1. After ensuring you have the requirements noted above, run:

   ```sh
   pnpm install
   ```

   … in the root directory of the repo.

2. Generate a compiled version of the tool by running:

   ```sh
   pnpm build
   ```

3. Run the [`link` command](https://pnpm.io/cli/link) to makes the local package accessible system-wide, or in another location.

   ```sh
   pnpm link
   ```

## Usage

> [!NOTE]
> This package has not been published, and therefore cannot currently be added to a project from a remote package manager repository (eg, `npm`).

Gust can be run by running…

```sh
gust
```

Without any arguments, it will execute the default command, and prompt the user to provide the necessary information for generating a Tailwind theme.

Gust supports the following commands:

### CLI Commands

| Command                    | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `gust [documentId]`        | Interactive setup wizard for generating a Tailwind CSS theme from scratch.    |
| `gust wizard [documentId]` | Same as above.                                                                |
| `gust audit`               | Creates a report comparing existing theme tokens to ones identified in Figma. |
| `gust login [accessToken]` | Store Figma API token for fetching document details.                          |
| `gust logout`              | Remove stored Figma API token.                                                |

### Arguments

Arguments and options for all wizard prompts can also be provided directly, by running:

```bash
gust [documentId] -o [cssOutputDir] -t [createText] -co [componentOutputDir]
```

…or…

```bash
gust wizard [documentId] -o [cssOutputDir] -t [createText] -co [componentOutputDir]
```

| Argument        | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `[documentId]`  | ID for the Figma document from which to generate a theme.         |
| `[accessToken]` | Figma access token for the user, to allow Figma API interactions. |

| Options                   | Description                                                                    |
| ------------------------- | ------------------------------------------------------------------------------ |
| `--output`/`-o`           | (Optional) Path for the CSS output directory.                                  |
| `--component-output`/`-c` | (Optional) Path for the generated component output directory.                  |
| `--create-text`/`-t`      | (Optional) Flag for creating a React-based Text component.                     |
| `--debug`                 | (Optional) When this flag is set, data will be saved to `.gust` for reference. |

## Utilities & useful commands

Common tooling, such as [ESLint](https://eslint.org/) for code linting, [Prettier](https://prettier.io) for code formatting, and [TypeScript](https://www.typescriptlang.org/) for static type checking, are all available as pnpm scripts.

To run relevant checks, use one of the commands below:

- `pnpm build` - Compile the tool and output the resulting artifacts.
- `pnpm format:fix` - Runs prettier and fixes formatting errors, if possible.
- `pnpm format` - Runs prettier and returns status indicating if formatting errors are present.
- `pnpm lint:fix` - Runs eslint and fixes formatting errors, if possible.
- `pnpm lint` - Runs eslint and returns status indicating if linting errors are present.
- `pnpm tsc` - Runs typescript and returns status indicating if static type-checking has passed.
- `pnpm test` - Runs the unit test suite. (TO BE IMPLEMENTED)

To run the tool in development mode without building:

- `pnpm dev`

## Ideas for later

Honestly, I probably won't finish this:

- Match full spec of tokens that may be exported by Token Export plugin.
- Generate additional components.
- Generate stories.
- Just make this a "one-button" Figma plugin that creates a .zip file of the generated contents that designers can export and pass to devs directly.
