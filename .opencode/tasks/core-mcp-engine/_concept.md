# core-mcp-engine — концепция MCP-движка: собранный контекст и открытые вопросы

Документ задачи `core-mcp-engine` (целевой проект — `packages/core`). Содержит результат
ознакомления с заготовкой, движком CLI и SDK `@modelcontextprotocol/server`, предлагаемую
архитектуру, фазы, риски и вопросы, ответы на которые определяют требования и декомпозицию.

Дата сбора: 2026-10-16. Репозиторий `/home/pasha/my/clapp`, ветка активного релиза `1.0-1`.

## 1. Что уже есть в проекте

### 1.1. Движок CLI (`CliEngine`)

`packages/core/src/engines/clapp/clapp.ts`:

- `initialize()` (`:39-51`) — `pluginManager.getDefinitions()` → `buildHierarchy(...)` →
  `createCommands(...)` (дерево commander), затем `allowExcessArguments()` на корне;
- `run(argv)` (`:60-62`) — `program.parseAsync(argv)`;
- `_commandAction(id, {name, args, opts})` (`:64-89`) — конвейер исполнения:
  `command:start` → `pluginManager.getInstance(id)` → `command:arguments` → `getArguments(args, opts)`
  → `command:run` → `action()` → `formatCommandResult()` → `command:end`; при ошибке —
  `command:error` и проброс исключения;
- `formatCommandResult(definition, result)` (`:102-122`) — резолв форматтера по
  `definition.formatter`, `format(result.data)`, запись в **`process.stdout`**;
- `_createCommand` (`:124-133`) и `createCommands` (`:135-149`) — регистрация команд и групп в
  commander (аргументы/опции через `initializeCommand` из `packages/core/src/utils/command.ts`);
- `parseCommandArgs` (`:151-156`) — из commander-вызова получает `{ name, args, opts }`.

### 1.2. Заготовка MCP-движка

`packages/core/src/engines/mcp/mcp.ts` (164 строки) — копия `CliEngine` с недоделанным MCP-слоем:

- `:20` импорт из `@modelcontextprotocol/server`: `createMcpHandler`, `Implementation`, `McpServer`,
  `McpServerFactory`; `:21` — `createServer` из `node:http` (не используется);
- `:30` `config: IAppConfig<Implementation>` — `Implementation` SDK подставлен как форма `engine`;
- `:35` `serverFactory!: McpServerFactory` — объявлено, но не заполняется;
- `:42-48` `initialize()` — определяет команды и вызывает **commander**-метод `createCommands`
  (движку MCP commander не нужен);
- `:50-52` `createServer()` — вызывает `createMCPServer(this.config.engine)`;
- `:61-69` `run()` — использует `createMcpHonoApp()`, `serve()`, `port` — **не импортированы и не
  объявлены**, файл не компилируется; `createMcpHonoApp` приходит из `@modelcontextprotocol/hono`
  (не установлен), `serve` — из `@hono/node-server` (не установлен);
- `:71-96` `_commandAction` — копия CLI-конвейера;
- `:109-129` `formatCommandResult` — пишет в **stdout**, что для stdio-транспорта недопустимо
  (stdout — канал протокола).

`packages/core/src/engines/mcp/utils.ts:3-6` — `createMCPServer(info)` создаёт `McpServer` и **ничего
не регистрирует**.

Факты о подключении:

- `MCPEngine` не реэкспортируется из `packages/core/src/public-api.ts` (шаблон экспортирует только
  `CliEngine`, `EventBus`, bootstrap, токены, utils) → в сборку не попадает;
- `packages/core/rollup.config.js` собирает `src/public-api.ts`; `EXTERNAL` = deps + peerDeps, то есть
  `@modelcontextprotocol/server` уже считается внешним;
- `packages/core/package.json` держит `@modelcontextprotocol/server: ^2.3.1` в `dependencies`; в
  `node_modules` стоят `@modelcontextprotocol/server` 2.3.1 и `@modelcontextprotocol/core` 2.3.1;
  `zod` 4.6.7 есть транзитивно; адаптеры (`node`, `hono`, `express`, `fastify`) не поставлены.

### 1.3. Контракты, от которых зависит маппинг в MCP

- `packages/core/src/types.ts`: `ICommandNode` (`:8-11`), `IAppConfig<E>` (`:36-43`, поле
  `engine: E`), `IEngine` (`:49-52`, `run(argv)/initialize()`), `ICommandExecArguments` (`:23-27`);
- `packages/common/src/types/plugin.ts`: `ICommandConfig` (`:6-11`), `IPluginCommandDefinition`
  (`:17-30`, есть `parent`, `formatter`, `config`, `pluginClass`), `IPluginCommand` (`:37-41`),
  `ICommandResult` (`:58-63`, `success`/`error?`/`data?`);
- `packages/common/src/types/commander.ts`: `ICommandOption` (`:5-13`: `short`, `name`, `description`,
  `defaultValue`, `required`, `type: string|boolean|number`, `choices`), `ICommandArgument`
  (`:18-25`: `name`, `description`, `parseArg`, `required`, `variadic`, `choices`) — готовая основа
  для генерации JSON Schema аргументов инструмента;
- `packages/common/src/types/formatter.ts`: `IPluginFormatter.format(data): Promise<string>`;
- `packages/common/src/types/events.ts`: карта событий `command:start/arguments/run/end/error`
  (`:36-47`), `IEventBus` (`:56-86`);
- `packages/core/src/config/config.ts`: `APP_CONFIG_DEFAULT` без поля `engine`; в
  `packages/ai/clapp.config.yml` ключа `engine` нет → `this.config.engine` на рантайме `undefined`;
- `packages/core/src/bootstrap.ts:23-61`: движок — параметр `bootstrapApp(engineClass, container,
  options)`, биндится в `ENGINE_TOKEN`; выбор движка остаётся за точкой входа хоста.

### 1.4. Смежные работы и состояние

- Задача `packages/core/.opencode/tasks/core-cli-facade` (профиль `normal`, все пункты `todo`):
  ядро избавляется от commander, CLI-слой описывается абстрактным фасадом и подключается через
  DI-токен, реализация на commander переезжает в `@clapp/ai`. `packages/core/src/constants/tokens.ts:7`
  уже импортирует `IEngine` из `../engines/engine-facade.base` — файла ещё нет (работа в процессе).
- Активный релиз `1.0-1`: группа `а5`/`а7` содержит задачи `ai-board-command-group` и
  `core-cli-facade`; при включении MCP-задачи в релиз нужны пункты групп `а`/`б`/`г`.
- Рабочее дерево: 44 изменённых/удалённых файла (в том числе файлы незавершённой `core-cli-facade`).
  До передачи задачи исполнителю (`@coder`) нужен коммит — правило раздела 15 workflow.

## 2. Что даёт SDK `@modelcontextprotocol/server` v2

Локальные факты по установленной версии 2.3.1 (`.d.mts` в `node_modules/@modelcontextprotocol/server/dist`),
плюс README репозитория SDK.

### 2.1. Пакеты

- `@modelcontextprotocol/server` 2.3.1 — серверная библиотека (tools/resources/prompts, stdio,
  Streamable HTTP, auth-хелперы); реализует спеку 2026-07-28; это **v2**, пришедший на смену
  монолитному `@modelcontextprotocol/sdk` (v1.x живёт отдельной веткой).
- `@modelcontextprotocol/core` 2.3.1 — публичные zod-схемы спеки и OAuth/OpenID.
- `@modelcontextprotocol/client` 2.3.1 — клиент (полезен для автотестов).
- Адаптеры: `@modelcontextprotocol/node` 2.1.1 (зависит от `hono` + `@hono/node-server`),
  `@modelcontextprotocol/hono` 2.0.2, `@modelcontextprotocol/express` 2.0.2,
  `@modelcontextprotocol/fastify` 2.0.1.
- Все пакеты — ESM (`"type": "module"`), engines — node >= 20.

### 2.2. Сервер и регистрация

- `new McpServer(serverInfo: Implementation, options?: McpServerOptions)`;
  `McpServerOptions = ServerOptions & { maxToolInputElements?: number }`,
  `ServerOptions = ProtocolOptions & { capabilities?, instructions?, jsonSchemaValidator?, cacheHints?, … }`.
- `registerTool(name, { title?, description?, inputSchema?, outputSchema?, annotations?, icons?, _meta? },
  cb)` — из одной схемы SDK получает JSON Schema для `tools/list`, валидирует аргументы и типизирует
  колбэк; аргументы, не прошедшие схему, возвращаются как результат `isError: true` (колбэк не
  вызывается). Есть `registerResource(...)`, `registerPrompt(...)`, а также низкоуровневый `Server`.
- Схемы — Standard Schema (zod v4, valibot, arkType, …); отдельно экспортируется
  **`fromJsonSchema(schema: JsonSchemaType, validator?): StandardSchemaWithJSON<T, T>`** — позволяет
  работать с обычным JSON Schema без zod (ключ к генерации схем из `ICommandConfig` без новой
  зависимости).
- `Implementation` — тип из схемы инициализации (имя, версия, прочее), то есть формат `serverInfo`.

### 2.3. Транспорты

- stdio: `@modelcontextprotocol/server/stdio` → `serveStdio(factory, options?)` (строит
  `StdioServerTransport` над stdout/stdin, сам решает эру протокола, закрывается по EOF stdin)
  и сам `StdioServerTransport`.
- HTTP: `createMcpHandler(factory, options?)` возвращает web-standard хендлер `{ fetch, close, notify,
  bus }`; опции — `legacy: 'stateless' | 'reject'`, `responseMode: 'auto' | 'sse' | 'json'`,
  `maxRequestBodySize` (по умолчанию 4 MiB), `bus`, `keepAliveMs`, `maxSubscriptions`, `onerror`.
  Для Node — адаптер `toNodeHandler(handler)` из `@modelcontextprotocol/node`
  (либо `NodeStreamableHTTPServerTransport` и guard'ы `localhostHostValidation()`/
  `localhostOriginValidation()` для самодельного `node:http`-сервера).
- `McpServerFactory = (ctx: McpRequestContext) => McpServer | Server | Promise<…>` — **новый инстанс
  на единицу обслуживания**: один HTTP-запрос под `createMcpHandler`, одно соединение (или
  отброшенный `server/discover`-проб) под `serveStdio`. В `ctx` — `era: 'legacy' | 'modern'`,
  `authInfo?`, `requestInfo?`. Все определения инструментов регистрируются в фабрике.

### 2.4. Результаты и ошибки

- `CallToolResult` — `content` (`text`/`image`/`audio`/`resource`/`resource_link`), опционально
  `structuredContent`, валидируемый по `outputSchema`, и `isError`.
- Ошибки валидации и брошенные исключения — это результат с `isError: true`, а не разрыв соединения.

## 3. Предлагаемая архитектура

### 3.0. Типы команд (решение пользователя, 2026-10-16)

Команда проекта бывает ровно трёх видов, и каждому виду соответствует своя поверхность MCP:

| вид команды | смысл | поверхность MCP | что отдаётся клиенту |
|---|---|---|---|
| `resource` — запрос информации | чтение данных о проекте/состоянии, без побочных эффектов | Resources (`resources/list`, `resources/read`) | данные (текст/структура) |
| `tool` — выполнение действия | действие в проекте в контексте workflow, с побочными эффектами | Tools (`tools/list`, `tools/call`) | результат действия |
| `prompt` — команда ИИ | отправка конкретной инструкции модели вместе с аргументами | Prompts (`prompts/list`, `prompts/get`) | сообщения для модели |

Следствие для модели данных: вид — атрибут определения команды. Предложение: поле
`kind: UCommandKind` в `IPluginCommandDefinition` (`packages/common/src/types/plugin.ts:17-30`) —
по аналогии с уже существующим `kind` у форматтеров
(`packages/common/src/types/formatter.ts:10-12`), значения — строковые константы в
`packages/common/src/constants/plugin-types.ts`:

```ts
export const COMMAND_KIND_RESOURCE = 'resource';
export const COMMAND_KIND_TOOL = 'tool';
export const COMMAND_KIND_PROMPT = 'prompt';

export type UCommandKind =
  | typeof COMMAND_KIND_RESOURCE
  | typeof COMMAND_KIND_TOOL
  | typeof COMMAND_KIND_PROMPT;
```

Почему `kind`, а не `type`: поле `type` уже занято типом плагина в `IPluginDefinition`
(`node_modules/@orion76/plugin/lib/types.d.ts:17-24`, значение `PLUGIN_COMMAND`).

**Итоговое решение (пользователь, 2026-10-16): поле обязательное, у группы тоже есть вид.** Форма
(предложение к реализации):

```ts
// packages/common/src/constants/plugin-types.ts (или отдельный модуль констант)

/** Виды команд: соответствуют поверхностям MCP. */
export const COMMAND_KIND_RESOURCE = 'resource';
export const COMMAND_KIND_TOOL = 'tool';
export const COMMAND_KIND_PROMPT = 'prompt';

/** Значение `kind` для узла-группы: команда-контейнер, на MCP не отображается. */
export const COMMAND_KIND_GROUP = 'group';

/** Три вида команд. */
export type UCommandKind =
  | typeof COMMAND_KIND_RESOURCE
  | typeof COMMAND_KIND_TOOL
  | typeof COMMAND_KIND_PROMPT;

/** Значение поля `kind` в определении: вид команды либо маркер группы. */
export type UCommandDefinitionKind = UCommandKind | typeof COMMAND_KIND_GROUP;
```

`IPluginCommandDefinition.kind: UCommandDefinitionKind` — обязательное поле; авторский тип
`IPluginCommandDefinitionData` (`Omit<…, 'pluginClass'>`) наследует его, поэтому все существующие
7 определений в `packages/ai/plugins/commands/**` получают вид в этой же задаче (`board` — группа,
`board/list`, `npm-info`, `skill-list` — запрос информации, `board/next`, `init`, `skill-add` — по
смыслу команды, уточняется при простановке). `CliEngine` это поле не читает — команды CLI работают
как раньше, синхронизация с CLI-движком отложена.

Что понадобится каждому виду дальше (форма — предмет следующих уточнений, сейчас фиксируется только
само разделение): ресурсу — источник URI (статический URI или шаблон с аргументами), инструменту —
аннотации и `outputSchema`, промпту — аргументы промпта и шаблон сообщений.

### 3.1. Общая база с CLI

CLI и MCP — два представления одного набора команд. Общее: resolve команды по id, события жизненного
цикла, `getArguments` + `action`. Различается ровно две вещи:

| | CLI (`CliEngine`) | MCP-движок |
|---|---|---|
| вход команды | argv (commander) | объект аргументов (JSON Schema) |
| выход | stdout (форматтер) | `content`/`structuredContent` ответа |

Отсюда предложение: вынести в ядре **`CommandExecutor`** (события + resolve + вызов `action`,
возвращает `ICommandResult`) и **приёмник вывода** (`IResultSink`/`ICommandOutput`: CLI-реализация
пишет в stdout, MCP-реализация возвращает строку как content-блок). Тогда MCP-движок не наследует
commander-код, а форматтеры переиспользуются как текстовый рендер результата для модели.

### 3.2. Команды → tools

- листовая команда (узел без детей) → один tool; группа (`parent`) → префикс имени, то есть
  `board` + `list` → `board_list` (или `board.list` — спека допускает `_`, `-`, `.`, `/`);
- `inputSchema` генерируется из `config.arguments` + `config.options`: `description`, `required`,
  `enum ← choices`, `default ← defaultValue`, тип ← `option.type`, `variadic` → массив; отдаётся в
  SDK через `fromJsonSchema(...)`;
- обратный маппинг `объект аргументов → argv` для существующего контракта
  `getArguments(args: string[], opts)` (позиционные по порядку объявления, опции как `--name value`);
  альтернатива — расширить контракт плагина типизированным путём аргументов (обсудить);
- расширение определения команды (в `@clapp/common`): необязательное поле
  `mcp?: { title?, annotations?, outputSchema?, toolName?, expose?: boolean }` — по умолчанию
  экспонируются листовые команды, группы — как префикс.

### 3.3. Результат вызова

- `success: true` + `formatter` → `content: [{ type: 'text', text: <вывод форматтера> }]`,
  при объявленном `outputSchema` — `structuredContent: result.data`;
- команда без `formatter` (печатает сама) — под stdio печать в stdout недопустима: варианты
  (а) не экспонировать, (б) требовать `data`, (в) перехватывать stdout — см. вопрос 4;
- `success: false`/исключение → `isError: true` с текстом ошибки;
- логи и предупреждения — только stderr; нужен аудит `process.stdout`/`console.*` в ядре.

### 3.4. Транспорт

- MVP — **stdio** (`serveStdio`): ноль дополнительных зависимостей, это то, что ждут MCP-клиенты
  (opencode/Claude/Cursor), фабрика получает DI-контейнер через замыкание движка;
- HTTP — вторая фаза: `createMcpHandler` + `toNodeHandler` (потянет hono и `@hono/node-server`) либо
  свой тонкий мост на `node:http`; конфиг `{ transport, port, host, path }`, bind на `127.0.0.1`
  по умолчанию (в черновике это отмечено комментарием `mcp.ts:63`).

### 3.5. Где живёт код

- **A. В ядре** (`packages/core/src/engines/mcp`) с peerDependency на SDK — быстро, но тянет MCP в
  ядро и противоречит решению `core-cli-facade` (commander выносится в хост);
- **B. Новый пакет `@clapp/mcp`** (или `@clapp/engine-mcp`): SDK — его собственная зависимость, ядро
  отдаёт `IEngine`, `CommandExecutor`, приёмник вывода и DI-токены — согласуется с линией «ядро без
  commander»; **рекомендация**;
- **C. В `@clapp/ai`** как первый потребитель (`clapp-ai mcp` над существующими командами
  `skill-*`/`board`) — быстрый прототип с живой проверкой; разумно делать прототип через C, а
  переиспользуемую часть — в B.

### 3.6. Фаза 2+

- `resources` — из `PLUGIN_CONTEXT`-контекстов и конфига (`clapp://config`, `clapp://commands`,
  состояние доски);
- `prompts` — новый тип плагина (`PLUGIN_PROMPT` или MCP-специфичный) с регистрацией через свой
  менеджер плагинов;
- мост событий: `EventBus` → MCP-нотификации (logging/progress) через notifier сервера;
  `subscriptions/listen` + `InMemoryServerEventBus` (2026);
- auth (bearer/OAuth), сессии — скорее всего вне рамок первой итерации.

## 4. Проверка

- юнит-тесты: генератор JSON Schema из `ICommandConfig`; маппинг имён/аргументов; маппинг результата
  (`content`/`structuredContent`/`isError`);
- интеграционные **без подпроцесса**: `InMemoryTransport` (экспортируется из
  `@modelcontextprotocol/server`) + клиент `@modelcontextprotocol/client` → `listTools()`/
  `callTool()` — дешёвый и точный smoke;
- smoke по выбранному транспорту: запуск бина (tsx) + handshake + `tools/list` — так подключится
  реальный клиент.

## 5. Риски и грабли

- stdout под stdio зарезервирован за протоколом: форматтеры, отладка и предупреждения ядра сейчас
  пишут туда;
- фабрика создаёт новый `McpServer` на запрос/соединение — регистрация инструментов должна быть
  дешёвой и детерминированной, реестр команд берётся из инжектированного `PluginManager`;
- ESM-only SDK: jest-конфигам пакетов понадобится `transformIgnorePatterns` (паттерн уже есть в
  `@clapp/ai`);
- двухэровность протокола (2025 legacy / 2026 modern): `serveStdio`/`createMcpHandler` решают эру
  сами, но `legacy: 'serve'|'stateless'|'reject'` — осознанный выбор;
- `IAppConfig.engine` типизирован, но нигде не заполнен: нужен нормальный тип опций движка и
  согласование `name`/`version`/`description` приложения с `serverInfo` (SDK `Implementation`);
- README SDK советует при TypeScript >= 6 добавлять `"types": ["node"]`; у нас TS 5.9 — не требуется;
- рабочее дерево не закоммичено — блокер перед `@coder`.

## 6. Решения и открытые вопросы

### 6.1. Решения (2026-10-16)

- **Три вида команд** ↔ MCP Resources / Tools / Prompts (см. § 3.0).
- **Поле `kind` — обязательное**, у узла-группы тоже есть значение (маркер группы), существующие
  7 определений в `packages/ai` обновляются в этой же задаче (§ 3.0).
- **Профиль задачи — `normal`**: документация и тесты в задачу не входят, они станут пунктами
  релизного `.opencode/releases/1.0-1/_todo.yml` (группы `б`/`г`, с указанием `core-mcp-engine`) —
  когда объём фаз 2+ станет окончательным.
- **С `CliEngine` изменения не синхронизируются**: текущая CLI-реализация не трогается; общий
  executor и приёмник вывода — отдельная работа позже (вопрос 9 закрыт).

### 6.2. Открытые вопросы

1. **Транспорт MVP**: stdio / HTTP / оба сразу?
2. **Размещение кода**: новый пакет `@clapp/mcp` (рекомендуется) / внутри ядра / прототип в `@clapp/ai`?
3. **Состав MVP**: только `tools` (команды проекта) или сразу `resources`/`prompts`?
4. **Команды без `formatter`**, печатающие сами: не экспонировать / требовать `data` / перехватывать
   stdout?
5. **Общая база с CLI**: когда делать `CommandExecutor` и приёмник вывода (сейчас решения нет —
   фаза 4 черновика).
6. **Детализация видов**: какой блок метаданных нужен ресурсу (URI/шаблон), инструменту (аннотации,
   `outputSchema`), промпту (аргументы и шаблон сообщений)?
7. **UX запуска**: подкоманда `clapp-ai mcp` (плагин-команда), отдельный bin, или флаг `--mcp` у
   существующего CLI?

## 7. Порядок работ (черновик фаз, до ответов на вопросы)

1. **Фаза 0 — решения**: ответы на вопросы § 6, актуализация этого документа, определение профиля.
2. **Фаза 1 — вид команды в определении плагина** (текущий шаг, по решению пользователя 2026-10-16):
   поле `kind` с тремя значениями в `@clapp/common`, его тип и константы, экспорт из публичного API,
   решение по совместимости с существующими определениями команд (`packages/ai`). Изменения не
   синхронизируются с текущей реализацией `CliEngine` — она остаётся как есть до отдельной доработки.
3. **Фаза 2 — MVP по выбранному транспорту**: рабочий движок, отображение видов команд на
   `resources`/`tools`/`prompts` в согласованном объёме, генерация схем и имён, маппинг результата,
   реэкспорт/сборка, конфиг движка, in-memory тест.
4. **Фаза 3 — HTTP-транспорт** (если не входит в MVP): `createMcpHandler` + node-адаптер (или свой
   мост), конфиг транспорта, host/origin-валидация, выбор эры протокола.
5. **Фаза 4 — нотификации и общая база с CLI**: мост `EventBus` → нотификации, общий executor и
   приёмник вывода, доработка `CliEngine`.
6. **Фаза 5 — auth/сессии**: только при явной необходимости.

Декомпозиция `_todo.yml` не выполнена (заготовка) — она выводится после фазы 0.
