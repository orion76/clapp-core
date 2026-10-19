import 'reflect-metadata';

// The tokens are exported first on purpose: the engines import them back through this entry
// point (a cycle), and the injection decorators of the engine classes read them while the
// classes are defined — that happens only after everything the entry point imported before
// the engines is evaluated, so an engine would otherwise read a token in its temporal dead
// zone (`Cannot access 'CLAPP_LOGGER_TOKEN' before initialization`).
export * from './constants/tokens';
export { CliEngine } from './engines/clapp/clapp';
export { MCPEngine } from './engines/mcp/mcp';
export { EventBus } from './events/event-bus';
export * from '@clapp/common';
export type { IInitAppOptions, IAppConfig, TCliConfigOverride } from './types';
export type {
  IMCPCommandInput,
  IMCPCommandInvoker,
  IMCPEntity,
  IMCPEntityRegistry,
  IMCPEntitySkip,
} from './engines/mcp/types';
export * from './bootstrap';

export * from './formatters';
export * from './plugins/formatters';
export * from './plugins/mcp-formatters';
export * from './plugin-loader';
export * from './utils/config';
export * from './utils';
