# core-formatter-output: Перенос форматтеров в ядро и вывод результата команды через плагин-форматтер

**Профиль:** normal

## Цель

Исправить раскладку форматтеров и связать их с командами:
1. плагины-форматтеры (`table`, `ordered-list`) и вся их рантайм-логика живут в `@clapp/core`, а не в
   `@clapp/common` (в `common` остаётся только тип плагина и контракт — типы);
2. `@clapp/command` предоставляет авторам команд список доступных форматтеров (`UFormatterKind`) и
   типы данных, которые команда возвращает (`ITableData`, `IOrderedListData`, …);
3. команда указывает форматтер в своём определении, возвращает **данные** (а не готовый текст), а
   ядро по идентификатору форматтера берёт нужный плагин, форматирует данные и печатает строку в
   stdout.

## Контекст

- **Целевой проект** — `packages/core` (`@clapp/core`); смежные правки — `packages/common` и
  `packages/command`. Работа ведётся в корне репозитория `/home/pasha/my/clapp`, ветка активного
  релиза `1.0-1`.
- **Что уже сделано предыдущей задачей** `common-formatter-plugins`
  (`packages/common/.opencode/tasks/common-formatter-plugins/`), в рабочем дереве **без коммита**:
  - `packages/common/src/constants/plugin-types.ts` — `PLUGIN_FORMATTER_TYPE = 'PLUGIN_FORMATTER'`
    (остаётся в `common`), тип добавлен в `UPluginTypes` (`packages/common/src/types/plugin.ts`);
  - `packages/common/src/types/formatter.ts:10-31` — контракт `IPluginFormatterDefinition<K>` (`kind`),
    `IPluginFormatterDefinitionData<K>` и `IPluginFormatter<D>` (`format(data): Promise<string>`)
    (остаётся в `common`);
  - `packages/common/src/formatters/**` — **переезжает в `core`**: `formatter.base.ts`
    (`PluginFormatterBase`), `styling.ts` (единственная обёртка над `@opentf/cli-styles`),
    `table/{table.plugin.ts,lib.ts,types.ts}`, `ordered-list/{ordered-list.plugin.ts,lib.ts,types.ts}`;
  - `packages/common/src/public-api.ts:11-18` — экспорт базового класса и обоих форматтеров (после
    переноса из `common` убрать, из публичного API `core` — добавить);
  - `packages/common/package.json` — `@opentf/cli-styles` в `dependencies` (переезжает в `core`) и
    peer-зависимости `@orion76/node-plugin`, `inversify`, `reflect-metadata` (проверить, нужны ли ещё
    `common` после переноса базового класса);
  - в `core` уже есть: `FORMATTER_MANAGER_TOKEN` (`packages/core/src/constants/tokens.ts:19`),
    `PLUGIN_FORMATTER_TYPE: { patterns: [] }` в `APP_CONFIG_DEFAULT.plugins`
    (`packages/core/src/config/config.ts:12`), `providePluginManager<IPluginFormatter>`
    (`packages/core/src/bootstrap.ts:54-58`) и резолв patterns форматтера от `appRoot`
    (`packages/core/src/utils/config.ts:50`).
- **Текущий контракт команды**: `ICommandResult { success: boolean; error?: string[] }`
  (`packages/common/src/types/plugin.ts:40`) — данных для форматтера в нём нет; команды печатают вывод
  сами (`console.log`/`process.stdout.write`), примеры — `packages/ai/src/commands/skill-list/skill-list.plugin.ts:35-45`,
  `packages/ai/src/commands/board/next/next.plugin.ts:36-46`.
- **Точка выполнения команды** — `Clapp._commandAction` (`packages/core/src/clapp.ts:69-93`): там
  уже резолвится плагин по id и проверяется `result.success`; `_createCommand`
  (`packages/core/src/clapp.ts:95-104`) получает `definition` целиком, включая `config`.
- **Пакет `@clapp/command`** — тонкий: `packages/command/src/public-api.ts` реэкспортирует
  `@clapp/common` и `PluginCommandBase`; `@clapp/command` уже peer-зависимость `core`, значит `core`
  может импортировать оттуда типы.
- **Плагинная система** — `@orion76/node-plugin` + `inversify` (legacy-декораторы,
  `@NodePlugin` выше `@injectable()`, `definition` приходит property-инъекцией). Форматтеры
  загружаются тем же загрузчиком по glob-паттернам `**/*.plugin.{js,ts}`.
- **Профиль `normal`**: документация и покрытие тестами в задачу не входят — они добавлены пунктами
  в активный релизный `.opencode/releases/1.0-1/_todo.yml` (группы `б` и `г`) с указанием
  `core-formatter-output`.
- **Ограничение окружения**: dev-запуск требует `tsx` с корневым `tsconfig.dev.json`
  (`npx tsx --tsconfig tsconfig.dev.json …`), иначе декораторы компилируются как стандартные и
  плагины падают. Временные файлы — только `tmp/` в корне репозитория (`AGENTS.md`).

## Требования

1. **Перенести форматтеры в `@clapp/core`.**
   - Перенести `packages/common/src/formatters/**` → `packages/core/src/formatters/**` (базовый класс,
     `styling.ts`, оба форматтера с их `lib.ts`/`types.ts`), поправив импорты: контракт и
     `PLUGIN_FORMATTER_TYPE` берутся из `@clapp/common`.
   - Из `@clapp/common` убрать реализации и базовый класс: почистить `public-api.ts`, удалить
     `src/formatters/**`, перенести `@opentf/cli-styles` из `dependencies` `packages/common/package.json`
     в `packages/core/package.json`; лишние peer-зависимости `common`, оставшиеся после переноса,
     убрать.
   - Из публичного API `core` экспортировать `PluginFormatterBase` и встроенные форматтеры
     (`TableFormatterPlugin`, `OrderedListFormatterPlugin`) — по образцу того, как `core` экспортирует
     встроенные контексты.
   - Типы данных форматтеров (`ITableData`, `TOrderedListMarker`, `IOrderedListItem`,
     `IOrderedListData` и вспомогательные) в `core` больше не нужны как «авторские» типы — их место
     в `@clapp/command` (см. п. 2); в `core` оставить только то, что нужно реализации.
2. **`@clapp/command`: список форматтеров и типы данных.**
   - Добавить `UFormatterKind` — union идентификаторов доступных форматтеров (`'table' | 'ordered-list'`).
   - Перенести в `@clapp/command` типы данных, которые команды возвращают и передают в форматтер:
     `ITableData` (заголовки, строки, `gap`), `IOrderedListData` (заголовок, описание, пункты, маркер)
     и вспомогательные типы к ним. Желательно связать вид и данные (например карта
     `вид → тип данных`), чтобы компилятор проверял соответствие `formatter` и возвращаемых данных.
   - Экспортировать всё это из `packages/command/src/public-api.ts` (новый модуль, например
     `packages/command/src/formatter/{types.ts,index.ts}`), с JSDoc на английском.
3. **Команда отдаёт данные, а не текст.**
   - Расширить `ICommandResult` (`packages/common/src/types/plugin.ts:40`) полем с данными
     (`data?: unknown`) — то, что команда передаёт форматтеру.
   - Дать команде способ указать форматтер в определении: поле `formatter` (в `config` или на верхнем
     уровне определения — на усмотрение кодера, выбор зафиксировать в `_task.md` задачи/отчёте),
     строковый тип в `@clapp/common` со строгим union из `@clapp/command` для авторов команд.
   - Совместимость: команда без `formatter` работает как раньше и печатает вывод сама.
4. **Ядро печатает отформатированный результат.**
   - В `Clapp._commandAction` (`packages/core/src/clapp.ts:69-93`): если у определения команды задан
     форматтер и команда завершилась успешно — получить плагин-форматтер по идентификатору через
     `FORMATTER_MANAGER_TOKEN`, вызвать `format(result.data)` и записать строку в `stdout`
     (`process.stdout.write` с переводом строки; пустая строка — ничего лишнего не печатать).
   - Понятные ошибки: неизвестный идентификатор форматтера и исключение внутри `format` должны
     приводить к сообщению об ошибке и ненулевому коду возврата (через существующий механизм
     `command:error` / `resolveExitCode`), а не к «молчаливому» успеху.
   - Форматирование не должно ломать команды без `formatter` и ветку `result.success === false`.
5. **Проверка результата (в рамках задачи).** Живой сквозной прогон: демо-команда с указанным
   форматтером, возвращающая данные (например `IOrderedListData` для todo-списка, а также данные для
   таблицы); приложение поднимается через `bootstrapApp` с in-memory конфигом (patterns на
   `packages/core/src/formatters/**/*.plugin.ts` и на демо-команду), запуск — `tsx` с
   `--tsconfig tsconfig.dev.json`, ожидаемый результат — отформатированный вывод в stdout, exit 0.
   Скрипты и демо-плагины — только в `tmp/` корня репозитория; команду и результат зафиксировать в
   `_reports.yml`.

## Критерии готовности

- В `packages/core/src/formatters/**` лежат оба форматтера и базовая логика; в `packages/common` не
  осталось ни реализаций, ни зависимости `@opentf/cli-styles`.
- В `@clapp/command` есть `UFormatterKind`, типы данных форматтеров и их связь; в `@clapp/common` —
  поле форматтера в определении команды и `data` в `ICommandResult`.
- Команда с `formatter` в определении печатает отформатированный ядром результат: живой прогон
  (`tsx`, демо в `tmp/`) даёт читаемый todo-список и таблицу, exit 0; команда без `formatter` и
  неуспешная команда ведут себя как раньше.
- `typecheck` затрагиваемых пакетов не даёт **новых** ошибок (`npx tsc -p packages/core/tsconfig.json
  --noEmit`, то же для `common` и `command`); известные чужие ошибки в `../@orion76/projects/logger`
  не считаются.
- Пункты `б10`/`г12` релизного `.opencode/releases/1.0-1/_todo.yml` (документация и тесты к этой
  задаче) существуют и пополнены по итогам работы.

## Вне рамок

- Перевод существующих команд `@clapp/ai` (`skill-list`, `board list/next`, `npm-info` и т. д.) на
  `formatter` и `data` — отдельная работа.
- Документация и юнит-тесты в самой задаче — вынесены в релизные пункты (`б10`, `г12`) по профилю
  `normal`.
- Новые форматтеры (json, tree, box, diff, progress), составной/вложенный вывод, ширина терминала,
  темы/палитры, локализация, вывод в stderr.
- Дефолтные patterns для встроенных форматтеров ядра (встроенные контексты ведут себя так же —
  patterns задаёт хост).
- Правки в `packages/ai` и в репозитории `/home/pasha/my/@orion76`, версии/changesets/публикация.
