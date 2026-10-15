# flat-command-hierarchy: Плоская иерархия команд: parent вместо commandType/commands

## Цель

Переделать организацию иерархии командных плагинов с явно вложенной
(`IPluginCommandWithSubcommandsDefinition`, `commandType: 'main'`, свойство `commands`) на **плоскую**:
любая команда — единая `IPluginCommandDefinition`, а принадлежность к группе задаётся полем
`parent` (id команды верхнего уровня). При инициализации commander (`Clapp.initialize`) сначала
строится дерево иерархии по полю `parent`, затем в соответствии с ним создаются команды commander.

## Контекст

- Файл, где живёт логика инициализации: `packages/core/src/clapp.ts`.
  - `initialize()` (стр. 42): `getDefinitions()` → `createProgram()` → `createCommands()`.
  - `createCommands()` (стр. 127): сейчас обрабатывает два типа — `isCommand()` → `_createCommand()`,
    `isMainCommand()` → группа с вложенными `commands` через `addCommand`.
  - `_createCommand()` (стр. 100): создаёт исполняемую команду, резолвит плагин через
    `pluginManager.getInstance(command.name())`.
- Типы в `packages/common/src/types/plugin.ts`:
  - `UCommandDefinitionType = 'command' | 'main'` (стр. 11);
  - `IPluginCommandDefinitionBase` с полем `commandType` (стр. 13);
  - `IPluginCommandDefinition` (стр. 17) — `commandType: 'command'`, `command`, `pluginClass`;
  - `IPluginCommandDefinitionData` (стр. 26) — Omit от `pluginClass`;
  - `IPluginCommand` (стр. 28) — интерфейс плагина команды;
  - `IPluginCommandWithSubcommandsDefinition` (стр. 34) — `commandType: 'main'`, `commands`;
  - `UPluginCommandDefinition` (стр. 39) — объединение двух типов;
  - `IPluginCommandWithSubcommands` (стр. 41).
- Утилиты в `packages/common/src/utils/command.ts`: `isCommand`/`isMainCommand` (стр. 3/7).
- Существующие определения плагинов команд, в которых надо убрать `commandType: 'command'`:
  - `src/commands/info/info.plugin.ts` (стр. 31);
  - `packages/ai/src/commands/{model,init,script,instruction,npm-info}.plugin.ts`;
  - `packages/ai/src/commands/skill/{add,list}.plugin.ts`.
- Базовый класс `PluginCommandBase<A>` (`packages/command/src/plugin.base.ts`) наследует
  `NodePluginBase<IPluginCommandDefinition<A>>` и использует `this.definition.command.arguments`.
- Плагины загружаются через `@orion76/node-plugin` (`PluginLoaderFromFile`): из модулей берутся
  экспортированные классы с прикреплённой декоратором `@NodePlugin`-определением. То есть группа —
  тоже класс с `@NodePlugin` (своё определение в плоском списке).
- Сборка: `npm run build:all` (rollup для common/core/command/utils, tsc для ai). Тесты:
  `npm run test:jest -w @clapp/core`.
- Текущие команды в репозитории — только верхнего уровня (групп нет). После рефакторинга поведение
  для них не должно измениться.

## Требования

1. Сделать тип `IPluginCommandDefinition` плоским: добавить поле `parent?: string` — id команды
   верхнего уровня (группы). Убрать `commandType`, `UCommandDefinitionType`,
   `IPluginCommandDefinitionBase`, `IPluginCommandWithSubcommandsDefinition`,
   `IPluginCommandWithSubcommands`, поле `commands`.
2. Упростить `UPluginCommandDefinition` до `IPluginCommandDefinition` (или убрать и заменить все
   использования на `IPluginCommandDefinition`). Обновить `clapp.ts` и всё остальное, что его
   импортирует.
3. Удалить `packages/common/src/utils/command.ts` (функции `isCommand`/`isMainCommand` больше не
   нужны) либо привести к актуальному виду — но они не должны использоваться из `clapp.ts`.
   Проверить, что нигде в репозитории нет других импортов этих функций.
4. Убрать `commandType: 'command'` из всех существующих определений плагинов команд
   (8 файлов, см. контекст).
5. В `packages/core/src/clapp.ts` добавить построение дерева иерархии из плоского списка
   определений по полю `parent`:
   - узлы без `parent` — корни;
   - узел с `parent` привязывается как потомок к узлу-родителю (по id);
   - если `parent` ссылается на несуществующий id — понятная ошибка/валидация.
6. Переписать `createCommands()` под дерево:
   - узел с потомками (группа) — `program.command(id)`, описание из `label`, рекурсивно
     `addCommand` для потомков, action не привязывается (группа ничего не делает);
   - узел-лист — `_createCommand(definition)` (как сейчас).
7. В `_createCommand()` резолвить плагин по `definition.id`, а не по `command.name()`, чтобы
   корректно работали сабкоманды (локальное имя в commander может не совпадать с глобальным id).
8. Проверить сборку (`npm run build:all`) и тесты (`npm run test:jest -w @clapp/core`), а также что
   dev-приложения `npm start` и `npm run start:ai` по-прежнему исполняют команды.

## Критерии готовности

- `packages/common/src/types/plugin.ts`: нет `commandType`, `UCommandDefinitionType`,
  `IPluginCommandWithSubcommandsDefinition`/`IPluginCommandWithSubcommands`; в
  `IPluginCommandDefinition` есть `parent?: string`; `UPluginCommandDefinition` — единый тип
  (или заменён на `IPluginCommandDefinition`).
- `packages/common/src/utils/command.ts` не содержит неиспользуемых `isCommand`/`isMainCommand`
  (файл удалён либо функции приведены в соответствие и не используются из `clapp.ts`).
- Ни одно определение плагина в `src/` и `packages/ai/src/commands/**` не содержит
  `commandType`.
- `packages/core/src/clapp.ts` строит дерево по `parent` и создаёт команды commander в соответствии
  с иерархией; для групп action не привязывается.
- `npm run build:all` — без ошибок.
- `npm run test:jest -w @clapp/core` — без ошибок.
- `npm start -- info` и `npm run start:ai -- skill-list` исполняются (см. раздел «Dev app» в
  `AGENTS.md`).

## Вне рамок

- Не добавляем реальные группы/сабкоманды в существующие плагины (нет такой потребности в задаче).
- Не меняем поведение групп с собственным action (группа не исполняет action в рамках этой задачи).
- Не трогаем контекст-плагины, event bus и другие подсистемы.
- Не трогаем типы `@orion76/*` (они вне рамок).
