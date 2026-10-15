# core-cli-facade: Ядро без commander — абстрактный класс-фасад CLI и реализация на commander в @clapp/ai

**Профиль:** normal

## Цель

Убрать зависимость `@clapp/core` от `commander`: ядро должно работать через абстрактный
класс-фасад CLI-интерфейса (создание программы, команд и групп, аргументов/опций, разбор `argv`,
помощь, коды возврата). Конкретную реализацию фасада на commander получает проект `@clapp/ai` —
ядро о commander больше ничего не знает. Это рабочий прототип: набор методов фасада — минимально
необходимый, чтобы текущее поведение CLI сохранилось.

## Контекст

- **Целевой проект** — `packages/core` (`@clapp/core`), сопутствующие правки — `packages/ai`.
  Репозиторий `/home/pasha/my/clapp`, ветка активного релиза `1.0-1`.
- **Где живёт commander сейчас** (единственный пакет в монорепозитории, который его использует):
  - `packages/core/src/utils/command.ts` — `Argument`, `Command`, `CommanderError`, `createOption`,
    `Option`: `buildCommandArgument`, `buildCommandOption`, `initializeCommand`, `createProgram`,
    `isInformationalInvocation`, `resolveExitCode`;
  - `packages/core/src/clapp.ts:2` — тип `Command`, `this.program`, `createCommands`/`_createCommand`,
    `parseAsync`, `allowExcessArguments`;
  - `packages/core/src/bootstrap.ts:2,83` — `CommanderError` в `reportFailedRun` (ошибки разбора не
    печатаются повторно) и `resolveExitCode` для кода возврата;
  - `packages/core/package.json` — `commander` в `peerDependencies:48`, в `keywords:21`, в
    `dependencies` корня (dev) и в `rollup.config.js` (external из deps+peerDeps).
  - `packages/utils/package.json:17` тоже держит `commander` в peer-зависимостях, но в коде его не
    использует — отдельная тема, вне рамок.
- **Публичный API ядра** (`packages/core/src/public-api.ts`) реэкспортирует `./utils` (включая
  `utils/command.ts`) и `./bootstrap`, поэтому форма фасада и судьба commander-специфичных хелперов —
  осознанное решение задачи (ломать совместимость допустимо, прототип).
- **Токены и DI**: `packages/core/src/constants/tokens.ts` (например `COMMAND_MANAGER_TOKEN`,
  `CLI_CONFIG_TOKEN`, `CLAPP_TOKEN`), `Clapp` получает зависимости property-инъекцией
  (`packages/core/src/clapp.ts:25-31`), менеджеры регистрируются `providePluginManager` в
  `packages/core/src/bootstrap.ts:40-58`.
- **Текущее поведение, которое нужно сохранить** (зафиксировано тестами и задачами
  `clapp-no-args-help`, `clapp-command-tree-fix`): запуск без аргументов печатает справку и завершается
  с кодом 0; `--help`/`--version` — код 0 без стектрейса; неизвестная команда — одна строка ошибки и
  код 1; группа команд (`parent` в определении, `buildHierarchy`) показывает справку только внутри
  группы; при нуле найденных плагинов — предупреждение в stderr.
- **Точка входа `@clapp/ai`** — `packages/ai/src/bin/clapp-ai.ts`: создаёт `Container`, вызывает
  `run(rootContainer, { configPath, appRoot })`; там же место для биндинга реализации фасада.
- **Профиль `normal`**: документация и покрытие тестами в задачу не входят — они добавлены пунктами
  в активный релизный `.opencode/releases/1.0-1/_todo.yml` (группы `б` и `г`) с указанием
  `core-cli-facade`.
- **Вне рамок известного долга**: собранный `dist/bin` `clapp-ai` падает на bootstrap с inversify
  `Found unexpected missing metadata on type "LoggerCollection"` (инлайн `@orion76/logger` в бандле
  ядра) — проверено ранее как предсуществующее, к этой задаче отношения не имеет.
- **Ограничения окружения**: dev-запуск — tsx с корневым `tsconfig.dev.json`
  (`npm run start:ai`), временные файлы — только `tmp/` в корне репозитория (`AGENTS.md`).

## Требования

1. **Абстрактный класс-фасад в ядре.**
   - Описать абстрактный класс (например `CliFacadeBase` в `packages/core/src/cli/` или
     `packages/core/src/utils/`), покрывающий только то, что ядру нужно сейчас: создание программы
     (`name`, `description`, `version`, поведение справки), регистрация команды и группы,
     добавление аргументов/опций/алиасов/описания, обработка action с аргументами и опциями, вывод
     помощи, разбор `argv`, признак «это ошибка разбора» с её кодом возврата, определение
     информационного запуска (help/version).
   - Типы фасада — из `@clapp/common` (`ICommandConfig`, `ICommandArgument`, `ICommandOption`,
     `IPluginCommandDefinition`) и локальных типов ядра (`ICliConfig`, `ICommandNode`); собственные
     типы фасада экспортировать из публичного API.
2. **Ядро работает только через фасад.**
   - `packages/core/src/clapp.ts`, `packages/core/src/utils/command.ts` (или его замену) и
     `packages/core/src/bootstrap.ts` перевести на фасад: никаких импортов `commander` в
     `packages/core/src/**`.
   - Убрать `commander` из `packages/core/package.json` (`peerDependencies`, `keywords`,
     описание пакета при необходимости) и из конфигурации сборки/external; старые
     commander-специфичные хелперы убрать или заменить на методы фасада (совместимость публичного
     API ядра можно сломать — это прототип, но изменение зафиксировать в `_reports.yml`).
   - `buildHierarchy`/`ICommandNode` остаются (они не зависят от commander).
3. **Подключение реализации через DI-токен.**
   - Добавить токен (например `CLI_FACADE_TOKEN`) в `packages/core/src/constants/tokens.ts` и
     инъекцию фасада в `Clapp` (property-инъекция, как остальные зависимости); без забинденной
     реализации — понятная ошибка, а не падение с «сырым» сообщением inversify.
   - Токен экспортировать из публичного API ядра.
4. **Реализация для `@clapp/ai`.**
   - Реализовать фасад на commander в `packages/ai` (например `packages/ai/src/cli/*.ts`) — весь
     commander-код, включая разбор аргументов/опций, справку, `exitOverride` и коды возврата,
     живёт здесь.
   - `commander` добавить в `dependencies` (или peer) `packages/ai/package.json`; в
     `packages/ai/src/bin/clapp-ai.ts` забиндить реализацию в контейнер до вызова `run`.
5. **Сохранить поведение CLI.**
   - Запуск без аргументов — справка и код 0; `--help`/`--version` — код 0; неизвестная команда —
     одна строка ошибки и код 1; группы команд (`board list`, `board next`) и их справка работают
     как раньше; предупреждение при нуле найденных плагинов остаётся.
6. **Живая проверка прототипа (в рамках задачи).**
   - Прогнать dev-запуск `@clapp/ai`: без аргументов, `--help`, `--version`, неизвестная команда,
     `skill-list`, `board list`, `board next` — зафиксировать коды возврата и вывод в `_reports.yml`
     (допустимое отклонение — только явно отмеченное в отчёте).
   - Проверить `grep` по `packages/core/src` — упоминаний commander нет; сборка
     `npm run build -w @clapp/core` и `npm run build -w @clapp/ai` проходит.

## Критерии готовности

- В `packages/core/src/**` нет импортов и упоминаний `commander`; пакет `@clapp/core` не объявляет
  commander ни в `dependencies`, ни в `peerDependencies`, ни в `keywords`.
- Абстрактный класс-фасад описан и экспортируется из публичного API ядра; `Clapp` получает его через
  DI-токен; без реализации — понятная ошибка.
- `@clapp/ai` содержит реализацию фасада на commander, биндит её в `bin/clapp-ai.ts`, держит
  `commander` в своих зависимостях.
- Dev-прогоны `npm run start:ai --` (без аргументов, `--help`, `--version`, неизвестная команда,
  `skill-list`, `board list`, `board next`) дают прежние коды возврата и сопоставимый вывод; результаты
  и все отклонения зафиксированы в `_reports.yml`.
- `npm run build -w @clapp/core` и `npm run build -w @clapp/ai` — зелёные.
- Релизные пункты `б11` (документация) и `г13` (тесты) в `.opencode/releases/1.0-1/_todo.yml`
  существуют и описывают эту задачу.

## Вне рамок

- Абстрагирование форматтеров от их реализации (архитектура это позволит — обсудим отдельно).
- Тесты и документация в самой задаче — по профилю `normal` они вынесены в релизные пункты
  `б11`/`г13`.
- Полноценный набор возможностей CLI в фасаде (интерактивные подсказки, автодополнение, парсеры
  значений сверх используемых сейчас) — только минимально необходимое для прототипа.
- Починка предсуществующего дефекта сборки ядра (`LoggerCollection` без `@inject` в
  `dist/clapp-core.js`) и запуск собранного `dist/bin` вне dev-режима.
- `commander` в `packages/utils/package.json` (не используется в коде), правки прочих пакетов,
  версии/changesets/публикация.
