> ⚠️ **Work in progress.** This package is under active development. A release is expected soon, but it is **not production-ready** yet: the API may change without notice. Do not use it in production.

> ⚠️ **В разработке.** Пакет ещё не готов к релизу: релиз ожидается в ближайшее время, API может меняться. Использовать в продакшне пока нельзя.

**English** | [Русский](./docs/ru/README.md)

# @clapp/core

The engine of the `clapp` CLI framework: it boots an application from a YAML config, discovers command, context and formatter plugins, and runs them either as a commander-based CLI or as an MCP server. It is a part of the [`orion76/clapp`](https://github.com/orion76/clapp) monorepo and builds on `@clapp/common` (contracts), `@clapp/utils` (helpers), `@orion76/node-plugin` and `inversify`.

## Features

- **Application bootstrap** — `bootstrapApp()` / `run()` build the application on the `inversify` container you pass, load the config, register a plugin manager per plugin type, initialize the engine and run it; a failed run is turned into a process exit code (`resolveExitCode`) and reported once.
- **`CliEngine`** — a commander program built from the command hierarchy of the plugin definitions: group nodes become command groups, leaf nodes become executable commands.
- **`MCPEngine` and the `clapp-mcp` bin** — the same commands exposed over stdio as MCP tools, resources and prompts; the surface follows the `kind` of each command definition.
- **Plugin discovery** on `@orion76/node-plugin` + `inversify` — every plugin type is described by *sources* (`appRoot`, `library`, `project`), each resolved against its own root; `ClappPluginLoader` matches the glob patterns of every source and rejects a definition whose type does not belong to the manager or whose id is already taken.
- **YAML configuration** — `clapp.config.yml` is merged over the defaults and its patterns are resolved against the root of their source (`loadConfig`, `createAppConfig`, `mergePlugins`); `APP_CONFIG_TOKEN` injects the resolved `IAppConfig`.
- **Formatter pipeline** — a command declares `formatter`, the engine resolves that plugin and renders the result data; the text goes to stdout in the CLI and is returned as the content of an MCP entity. The built-in `table`, `ordered-list` and `key-value` implementations ship in `@clapp/common`.
- **Lifecycle hooks** — the shared `EventBus` (re-exported from `@clapp/common`) runs `command:start`, `command:arguments`, `command:run`, `command:end` and `command:error` listeners as a pipeline around every command.
- **Lazy TypeScript plugin loading** — `ensureTsLoader()` registers the `tsx` loader on demand, so plugins may be shipped as `.ts` while JavaScript-only applications pay nothing for it.

## Installation

The package is not published to npm yet, so `npm install @clapp/core` does not resolve until the first release. Until then it is consumed as a workspace package of the monorepo:

```bash
npm install @clapp/core @clapp/common @clapp/utils
```

## Usage

### Application entry point

```ts
#!/usr/bin/env node
import 'reflect-metadata';

import { CliEngine, run } from '@clapp/core';
import { Container } from 'inversify';

const container = new Container();

await run(CliEngine, container, { configPath: 'clapp.config.yml' });
```

`run()` bootstraps the application and runs it with `process.argv`; use `bootstrapApp()` instead when the engine is needed directly (`await app.run(argv)`). The application root is derived from the entry script (the nearest `package.json` above it) and is the base of the `appRoot` plugin source.

### Configuration

```yaml
name: my-cli
description: A custom CLI built with @clapp/core
version: 0.1.0
plugins:
  PLUGIN_COMMAND:
    sources:
      # Patterns are relative to the application root.
      - type: appRoot
        patterns:
          - plugins/commands/**/*.plugin.{js,ts}
      # Patterns are relative to the directory of the named package.
      - type: library
        library: '@clapp/ai-workflow-plugins'
        patterns:
          - src/plugins/commands/**/*.plugin.{js,ts}
  PLUGIN_FORMATTER:
    sources:
      - type: library
        library: '@clapp/common'
        patterns:
          - src/plugins/formatters/**/*.plugin.{js,ts}
```

The third source type, `project`, resolves its patterns against the root of the project the launcher runs in (the nearest `package.json` above the working directory) and is empty when there is no project.

### Plugin development

A command is a `PLUGIN_COMMAND` plugin: a class decorated with `@NodePlugin` that carries the definition and extends `PluginCommandBase`. The loader finds it by the glob patterns of the config, so the file has to live under one of the declared source directories (for a project, `plugins/commands/**/*.plugin.ts`).

```ts
import { NodePlugin } from '@orion76/node-plugin';
import { injectable } from 'inversify';

import {
  COMMAND_KIND_TOOL,
  PLUGIN_COMMAND_TYPE,
  PluginCommandBase,
  type ICommandResult,
  type IPluginCommandDefinitionData,
} from '@clapp/common';

@NodePlugin<IPluginCommandDefinitionData>({
  type: PLUGIN_COMMAND_TYPE,
  kind: COMMAND_KIND_TOOL,
  id: 'greet',
  command: 'greet',
  label: 'Greet the user',
  formatter: 'ordered-list',
  config: {
    description: 'Print a greeting',
    arguments: [{ name: 'name', description: 'Who to greet', required: true }],
  },
})
@injectable()
export class GreetCommandPlugin extends PluginCommandBase<{ name: string }> {
  async action(args: { name: string }): Promise<ICommandResult> {
    return { success: true, data: { title: `Hello, ${args.name}!`, items: ['Say hello', 'Get to work'] } };
  }
}
```

A definition carries `type`, `kind` (`tool` | `resource` | `prompt` | `group`), a unique `id`, the `command` name and its optional `parent` for a subcommand, a `label`, an optional `formatter` and the `config` with `arguments` and `options`. An `MCPEngine` host exposes only leaf commands that declare a formatter; anything else is reported to stderr instead of silently disappearing.

### Running inside the monorepo

```bash
npm run build:core      # build the package
npm run typecheck -w @clapp/core
npm run start:ai        # the CLI host of the monorepo
npm run start:ai-mcp    # the MCP host of the monorepo
```

## Related packages

| Package                                                                     | Repository                                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`@clapp/common`](https://www.npmjs.com/package/@clapp/common)               | [`orion76/clapp-common`](https://github.com/orion76/clapp-common)                         |
| [`@clapp/utils`](https://www.npmjs.com/package/@clapp/utils)                 | [`orion76/clapp-utils`](https://github.com/orion76/clapp-utils)                           |
| [`@clapp/ai-workflow-plugins`](https://www.npmjs.com/package/@clapp/ai-workflow-plugins) | [`orion76/clapp-ai-workflow-plugins`](https://github.com/orion76/clapp-ai-workflow-plugins) |
| [`@clapp/ai-workflow-cli`](https://www.npmjs.com/package/@clapp/ai-workflow-cli) | [`orion76/clapp-ai-workflow-cli`](https://github.com/orion76/clapp-ai-workflow-cli)       |
| [`@clapp/ai-workflow-mcp`](https://www.npmjs.com/package/@clapp/ai-workflow-mcp) | [`orion76/clapp-ai-workflow-mcp`](https://github.com/orion76/clapp-ai-workflow-mcp)       |

## License

MIT
