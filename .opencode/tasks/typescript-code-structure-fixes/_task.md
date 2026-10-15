# typescript-code-structure-fixes: Привести @clapp/core к правилам скилла typescript-code-structure

## Цель

Устранить дефекты, найденные в ревью `typescript-code-structure-review` (вердикт `failed`), и
привести исходники `@clapp/core` (`packages/core/src/**`) в соответствие правилам скилла
`typescript-code-structure`: размещение типов, `import type`, порядок и объединение импортов,
именование файлов, отсутствие мёртвых модулей и лишних переименований.

## Контекст

- Целевой проект: `packages/core` (пакет `@clapp/core`).
- Скилл: `/home/pasha/my/ai/opencode-config/skills/typescript-code-structure/SKILL.md`.
- Источник: отчёт ревью в файле-конверте
  `packages/core/.opencode/messages/reviewer-planner.yml` (`result: failed`).
- Отчёт ревью-задачи: `packages/core/.opencode/tasks/typescript-code-structure-review/`.
- Пакет TS/ESM (`moduleResolution: bundler`, `strict`); правила Prettier: `singleQuote`,
  `tabWidth 2`, `printWidth 120`, `semi`, `trailingComma: all`.
- Найденные отчётом дефекты (по категориям скилла):

  **Типы — объявлены в implementation-файлах (нарушено «типы отдельно от реализации»):**
  - `src/clapp.ts:25` — `interface ICommandNode`.
  - `src/init-app.ts:13` — `export interface IInitAppOptions`.
  - `src/logger-init.ts:3` — `type UNames`.
  - `src/events/event-bus.ts:9` — `type TAnyHookListener`.

  **`import type` — типы импортируются как value-импорт:**
  - `src/clapp.ts:1-12` (`IClapp`, `ICliConfig`, `ICommandArgument`, `ICommandDefintion`,
    `ICommandOption`, `IEventBus`, `IPluginCommand`, `IPluginCommandDefinition`).
  - `src/bootstrap.ts:1-8` (`IPluginContext`, `ICliConfig`).
  - `src/logger-init.ts:1` (`TLogger`, `ILoggerConfig`, `UConsoleLevels`).
  - `src/context/context-plugin.ts:1` (`IPluginContext`, `IPluginContextDefinition`).
  - `src/context/plugins/process.context.ts:1`, `cwd.context.ts:1`, `user-home.context.ts:1`,
    `app-root.context.ts:1` (`IPluginContext`, `IPluginContextDefinition`).

  **Порядок импортов (внешние → внутренние → относительные) и дублирование:**
  - `src/tokens.ts:1,3` — два отдельных `import type` из `@clapp/common`; порядок
    (`@clapp/common` → `@orion76/node-plugin` → `@clapp/common` → `inversify`) нарушен.
  - `src/clapp.ts:1-15` — внутренний `@clapp/common` раньше внешних пакетов.
  - `src/context/app-context.ts:1-3` — внешний `inversify` после внутренних.
  - `src/bootstrap.ts:1-10` — внутренний `@clapp/common` раньше внешних.
  - `src/init-app.ts:1-3` — внутренний `@clapp/common` раньше `node:path` и `inversify`.
  - `src/config.ts:1-5` — внешний `js-yaml` после внутреннего `@clapp/common`.
  - `src/context/plugins/user-home.context.ts:1-4` — внешний `@orion76/node-plugin` после внутренних.
  - `src/context/plugins/app-root.context.ts:1-4` — внешний `@orion76/node-plugin` после внутренних.

  **Файлы/модули:**
  - `src/context/plugins/config.context.ts:1-10` — модуль содержит только закомментированный код
    (нет активного экспорта) → мёртвый модуль.
  - `src/context/context-plugin.ts:10` — класс `PluginContextBase` в файле `context-plugin.ts`;
    имя файла должно быть kebab-case от имени класса и отражать назначение.
  - `src/public-api.ts:4` — `export { EventBus as AsyncEventBus }` переименовывает экспорт без
    конфликта имён (в `@clapp/common` есть только `IEventBus`, не `EventBus`).

  **Форматирование:**
  - `src/logger-init.ts:7-14` — отступ 4 пробела вместо `tabWidth 2`.
  - `src/clapp.ts:158` — `return commandPlugin;` без отступа.

## Требования

1. Вынести типы из implementation-файлов в отдельные файлы типов по правилам скилла:
   `interface ICommandNode` (`clapp.ts`), `IInitAppOptions` (`init-app.ts`), `UNames`
   (`logger-init.ts`), `TAnyHookListener` (`event-bus.ts`). Небольшой объём — `types.ts` в корне
   модуля; при необходимости — подпапка `types/`.
2. Заменить value-импорты типов на `import type` (или инлайн-модификатор `type`) во всех
   перечисленных файлах: `clapp.ts`, `bootstrap.ts`, `logger-init.ts`, `context-plugin.ts`,
   `context/plugins/{process,cwd,user-home,app-root}.context.ts`.
3. Привести порядок импортов к «внешние пакеты → внутренние модули → относительные файлы»:
   `tokens.ts`, `clapp.ts`, `context/app-context.ts`, `bootstrap.ts`, `init-app.ts`, `config.ts`,
   `context/plugins/user-home.context.ts`, `context/plugins/app-root.context.ts`.
4. Объединить дублирующиеся `import type` из `@clapp/common` в `src/tokens.ts` в один импорт.
5. Удалить мёртвый модуль `src/context/plugins/config.context.ts` (только закомментированный код).
6. Привести файл `context-plugin.ts` в соответствие правилу «1 класс = 1 файл»: имя файла —
   kebab-case от имени класса (`PluginContextBase`) и отражает назначение; обновить все импорты,
   ссылающиеся на этот файл, и экспорт в `public-api.ts`/`context`.
7. Убрать лишнее переименование экспорта в `src/public-api.ts:4`: экспортировать `EventBus`
   под исходным именем (без `as AsyncEventBus`), если нет конфликта имён.
8. Исправить форматирование: `src/logger-init.ts` (отступ 2 пробела), `src/clapp.ts:158` (отступ).
9. Сохранить поведение и публичный API пакета (кроме переименования `AsyncEventBus`, если оно
   признано лишним): не ломать экспорты `@clapp/core` и типы `@clapp/common`.

## Критерии готовности

- Все дефекты из отчёта ревью (`packages/core/.opencode/messages/reviewer-planner.yml`) устранены;
  файлов, где типы объявлены вместе с реализацией, не осталось.
- `grep` не находит value-импортов типов в перечисленных файлах (только `import type` / `type`).
- Порядок импортов соответствует скиллу; из `@clapp/common` нет двух отдельных импортов в одном файле.
- `src/context/plugins/config.context.ts` удалён; файл класса `PluginContextBase` переименован,
  ссылки обновлены.
- `npm run build:core` (сборка) проходит без ошибок типов.

## Вне рамок

- Изменения в других пакетах (`@clapp/command`, `@clapp/common`, `@clapp/utils`, `@clapp/ai`),
  кроме обновления импортов, если файл был переименован.
- Не проверять и не редактировать `dist/`.
- Не менять функциональность и не рефакторить логику, не связанную с дефектами отчёта.
- Не запускать публикацию пакета.
