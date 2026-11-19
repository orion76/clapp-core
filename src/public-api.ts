import 'reflect-metadata';

// The tokens are exported first on purpose: the engines import them back through this entry
// point (a cycle), and the injection decorators of the engine classes read them while the
// classes are defined — that happens only after everything the entry point imported before
// the engines is evaluated, so an engine would otherwise read a token in its temporal dead
// zone (`Cannot access 'CLAPP_LOGGER_TOKEN' before initialization`).
export { EventBus } from '@clapp/common';
export * from './constants/tokens';
export { CliEngine } from './engines/clapp/clapp';
export { MCPEngine } from './engines/mcp/mcp';

export * from './bootstrap';
export type { IMCPCommandInput, IMCPCommandInvoker, IMCPEntity, IMCPEntityRegistry, IMCPEntitySkip } from './engines/mcp/types';


export * from './plugin-loader';
export * from './utils';
export * from './schemas';

