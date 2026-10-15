/**
 * Built-in formatters of `@clapp/core`: the base class of a formatter plugin and
 * the formatters shipped with the library. A host application opts into them by
 * adding their modules to the discovery patterns of `PLUGIN_FORMATTER_TYPE`.
 */

export * from './formatter.base';
export * from './table/table.plugin';
export * from './ordered-list/ordered-list.plugin';
export * from './key-value/key-value.plugin';
