> ⚠️ **В разработке.** Пакет ещё не готов к релизу: релиз ожидается в ближайшее время, API может меняться. Использовать в продакшне пока нельзя.

[English](../README.md)

# @clapp/core

Движок CLI-фреймворка `clapp`: он поднимает приложение из YAML-конфига, находит плагины команд, контекстов и форматтеров и запускает их либо как CLI на commander, либо как MCP-сервер. Пакет входит в монорепозиторий [`orion76/clapp`](https://github.com/orion76/clapp) и построен на `@clapp/common` (контракты), `@clapp/utils` (помощники), `@orion76/node-plugin` и `inversify`.

## Возможности

- **Загрузка приложения** — `bootstrapApp()` / `run()` собирают приложение в переданном вами контейнере `inversify`, загружают конфиг, регистрируют менеджер плагинов для каждого типа плагинов, инициализируют движок и запускают его; неудачный запуск превращается в код завершения процесса (`resolveExitCode`) и сообщается один раз.
- **`CliEngine`** — программа на commander, собранная из иерархии команд определений плагинов: узлы-группы становятся группами команд, листовые узлы — исполняемыми командами.
- **`MCPEngine` и bin `clapp-mcp`** — те же команды, выставленные по stdio как инструменты, ресурсы и подсказки MCP; состав поверхности определяется `kind` каждого определения команды.
- **Discovery плагинов** на `@orion76/node-plugin` + `inversify` — каждый тип плагинов описывается *источниками* (`appRoot`, `library`, `project`), и каждый из них разрешается относительно своего корня; `ClappPluginLoader` сопоставляет glob-паттерны всех источников и отклоняет определение, тип которого не принадлежит менеджеру или id которого уже занят.
- **Конфигурация в YAML** — `clapp.config.yml` накладывается поверх значений по умолчанию, а его паттерны разрешаются относительно корня своего источника (`loadConfig`, `createAppConfig`, `mergePlugins`); `APP_CONFIG_TOKEN` внедряет готовую конфигурацию `IAppConfig`.
- **Конвейер форматтеров** — команда объявляет `formatter`, движок находит этот плагин и рендерит данные результата; в CLI текст уходит в stdout, в MCP возвращается как содержимое сущности. Встроенные реализации `table`, `ordered-list` и `key-value` поставляются в `@clapp/common`.
- **Хуки жизненного цикла** — общая `EventBus` (реэкспортируется из `@clapp/common`) прогоняет обработчики `command:start`, `command:arguments`, `command:run`, `command:end` и `command:error` конвейером вокруг каждой команды.
- **Ленивая загрузка TypeScript-плагинов** — `ensureTsLoader()` регистрирует загрузчик `tsx` по требованию, поэтому плагины можно поставлять в виде `.ts`, а приложения только на JavaScript за это не платят.

## Установка

Пакет ещё не опубликован в npm, поэтому `npm install @clapp/core` ничего не установит до первого релиза. До этого пакет используется как workspace-пакет монорепозитория:

```bash
npm install @clapp/core @clapp/common @clapp/utils
```

## Использование

### Точка входа приложения

```ts
#!/usr/bin/env node
import 'reflect-metadata';

import { CliEngine, run } from '@clapp/core';
import { Container } from 'inversify';

const container = new Container();

await run(CliEngine, container, { configPath: 'clapp.config.yml' });
```

`run()` поднимает приложение и запускает его с `process.argv`; если нужен сам движок, используйте `bootstrapApp()` (`await app.run(argv)`). Корень приложения выводится из входного скрипта (ближайший `package.json` выше него) и служит базой источника плагинов `appRoot`.

### Конфигурация

```yaml
name: my-cli
description: A custom CLI built with @clapp/core
version: 0.1.0
plugins:
  command:
    sources:
      # Patterns are relative to the application root.
      - type: appRoot
        patterns:
          - plugins/command/**/*.plugin.{js,ts}
      # Patterns are relative to the directory of the named package.
      - type: library
        library: '@clapp/ai-workflow-plugins'
        patterns:
          - src/plugins/command/**/*.plugin.{js,ts}
  formatter:
    sources:
      - type: library
        library: '@clapp/common'
        patterns:
          - src/plugins/formatter/terminal/**/*.plugin.{js,ts}
```

Третий тип источника, `project`, разрешает свои паттерны относительно корня проекта, в котором запущен лаунчер (ближайший `package.json` выше рабочей директории), и остаётся пустым, когда проекта нет.

### Разработка плагинов

Команда — это плагин `command` (значение `PLUGIN_COMMAND_TYPE`): класс с декоратором `@NodePlugin`, который несёт определение и наследует `PluginCommandBase`. Загрузчик находит его по glob-паттернам конфига, поэтому файл должен лежать в одном из объявленных каталогов источника (для проекта — `plugins/command/**/*.plugin.ts`).

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

Определение несёт `type`, `kind` (`tool` | `resource` | `prompt` | `group`), уникальный `id`, имя `command` и необязательный `parent` для подкоманды, `label`, необязательный `formatter` и `config` с `arguments` и `options`. Хост `MCPEngine` выставляет только листовые команды, объявившие форматтер; всё остальное сообщается в stderr, а не исчезает молча.

### Работа внутри монорепозитория

```bash
npm run build:core      # build the package
npm run typecheck -w @clapp/core
npm run start:ai        # the CLI host of the monorepo
npm run start:ai-mcp    # the MCP host of the monorepo
```

## Связанные пакеты

| Пакет                                                                       | Репозиторий                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`@clapp/common`](https://www.npmjs.com/package/@clapp/common)               | [`orion76/clapp-common`](https://github.com/orion76/clapp-common)                         |
| [`@clapp/utils`](https://www.npmjs.com/package/@clapp/utils)                 | [`orion76/clapp-utils`](https://github.com/orion76/clapp-utils)                           |
| [`@clapp/ai-workflow-plugins`](https://www.npmjs.com/package/@clapp/ai-workflow-plugins) | [`orion76/clapp-ai-workflow-plugins`](https://github.com/orion76/clapp-ai-workflow-plugins) |
| [`@clapp/ai-workflow-cli`](https://www.npmjs.com/package/@clapp/ai-workflow-cli) | [`orion76/clapp-ai-workflow-cli`](https://github.com/orion76/clapp-ai-workflow-cli)       |
| [`@clapp/ai-workflow-mcp`](https://www.npmjs.com/package/@clapp/ai-workflow-mcp) | [`orion76/clapp-ai-workflow-mcp`](https://github.com/orion76/clapp-ai-workflow-mcp)       |

## Лицензия

MIT
