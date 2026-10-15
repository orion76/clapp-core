# typescript-code-structure-review: Ревью @clapp/core на соответствие скиллу typescript-code-structure

## Цель

Проверить исходники `@clapp/core` (пакет `packages/core`) на соответствие правилам скилла
`typescript-code-structure` и сохранить полный отчёт ревью в файл-конверт
`packages/core/.opencode/messages/reviewer-planner.yml` (создают инициатор, заполняет reviewer).
В чат reviewer отправляет только короткое сообщение с путём к конверту.

Ревью — проверочное, не вносит изменений в код.

## Контекст

- Целевой проект: `packages/core` (пакет `@clapp/core`).
- Скилл: `/home/pasha/my/ai/opencode-config/skills/typescript-code-structure/SKILL.md`
  (дубликат: `/home/pasha/.config/opencode/skills/typescript-code-structure/SKILL.md`).
- Содержание скилла (правила проверки):
  - **Модульная структура**: каждый модуль — отдельная папка под одну область ответственности;
    подпапки `types/`, `utils/`, `helpers/` — только при явной потребности; общие модули — в общий
    каталог (`src/shared`, `src/common`), не вложенные в конкретный модуль.
  - **Типы**: типы (`type`/`interface`) хранятся отдельно от implementation-файлов; небольшой объём
    (~10–20 типов) — в одном `types.ts` в корне модуля; большой — разбивать на файлы по назначению в
    подпапке `types/` модуля; файлы типов именовать по назначению (`page.ts`, `form.ts`), не
    абстрактно (`types1.ts`); экспорт через `export type`/`export interface`, импорт через `import type`.
  - **Файлы**: 1 класс = 1 файл; имя файла — имя класса в kebab-case; суффикс файла отражает
    назначение (`locator.service.ts`, `region.proxy.ts`, `home.page.ts`); типы не смешивать с
    implementation-файлами.
  - **Импорты**: не переименовывать импорты без конфликта имён/явного указания; порядок —
    внешние пакеты → внутренние модули → относительные файлы; для типов — `import type`.
- Проверяемый код: `packages/core/src/**` (файлы перечислены в отчёте reviewer'а).
- Текущая структура `src/`: `bootstrap.ts`, `clapp.ts`, `command-plugin-loader.ts`, `config.ts`,
  `context/` (app-context.ts, context-plugin.ts, plugins/*), `events/event-bus.ts`, `index.ts`,
  `init-app.ts`, `logger-init.ts`, `public-api.ts`, `tokens.ts`, `utils/` (index.ts, runtime.ts,
  ts-loader.ts).
- Тесты: `packages/core/tests/**` (jest).

## Требования

1. Проверить все файлы `packages/core/src/**` (и, при необходимости, `tests/**`) на соответствие
   каждому разделу скилла: модульная структура, типы, файлы, импорты.
2. Для каждого выявленного отклонения указать `file_path:line` и краткое описание.
3. Записать полный отчёт ревью в файл-конверт `packages/core/.opencode/messages/reviewer-planner.yml`
   по YAML-схеме раздела 9 ai-workflow.md: `task`, `target`, `reviewer`, `result` (`passed`/`failed`),
   `checked`, `defects` (с `file_path:line`), `commands`.
4. В чат отправить только короткое сообщение (не вставляя текст отчёта):
   - при успехе — «Ревью пройдено успешно. Задача закрыта. Отчёт: `<путь к конверту>`»;
   - при неуспехе — «Ревью не пройдено / не выполнены DoD. Отчёт: `<путь к конверту>`».
5. Код не изменять — только проверить и записать отчёт в файл-конверт.

## Критерии готовности

- Файл-конверт `packages/core/.opencode/messages/reviewer-planner.yml` заполнен отчётом по YAML-схеме
  раздела 9 (поля `task`, `target`, `reviewer`, `result`, `checked`, `defects` с `file_path:line`,
  `commands`).
- В `result` отражён вердикт (`passed`/`failed`), а `defects` (при `failed`) содержат все найденные
  отклонения с `file_path:line`.
- Каждое правило скилла проверено и покрыто в отчёте.

## Вне рамок

- Не вносить изменения в код (только проверка и отчёт).
- Не проверять другие пакеты (`@clapp/command`, `@clapp/common`, `@clapp/utils`, `@clapp/ai`),
  только `@clapp/core` — если не требуется для полноты проверки импортов из core.
- Не проверять `dist/` и сборку.
- Не исполнять команды, меняющие состояние репозитория (git add/commit/push).
