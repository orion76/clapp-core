import process from 'node:process';

import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';

import { PluginContextBase } from '../plugin-context.base';

@NodePlugin<IPluginContextDefinition<NodeJS.Process>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'process',
  label: 'App process',
})
export class ProcessContext extends PluginContextBase<NodeJS.Process> implements IPluginContext<NodeJS.Process> {
  getContext(): Promise<NodeJS.Process> {
    return Promise.resolve(process);
  }
}
