/**
 * Built-in terminal formatters of `@clapp/core`: the formatters shipped with the
 * library that render a command result for a terminal. A host application opts
 * into them by adding their modules to the discovery patterns of
 * `PLUGIN_FORMATTER_TYPE`. The base class of a formatter plugin is exported from
 * `src/formatters`.
 */

export * from './table/table.plugin';
export * from './ordered-list/ordered-list.plugin';
export * from './key-value/key-value.plugin';
