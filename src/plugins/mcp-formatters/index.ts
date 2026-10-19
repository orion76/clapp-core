/**
 * Built-in MCP formatters of `@clapp/core`.
 *
 * The MCP formatters are the formatter set an MCP server renders its command results with: they
 * carry the same ids (`table`/`ordered-list`/`key-value`) and kinds as the terminal formatters of
 * `src/plugins/formatters`, but write plain text for the protocol stream and carry no ANSI sequences.
 * The set has no plugin type of its own — a host opts into it by pointing the discovery patterns
 * of `PLUGIN_FORMATTER_TYPE` at these modules, which is the only thing that separates it from the
 * terminal set. Every formatter extends the shared base class of `src/formatters`.
 */

export * from './table/table.plugin';
export * from './ordered-list/ordered-list.plugin';
export * from './key-value/key-value.plugin';
