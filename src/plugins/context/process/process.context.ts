import process from 'node:process';

import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, PluginContextBase, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';

@NodePlugin<IPluginContextDefinition<NodeJS.Process>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'process',
  label: 'App process',
})
export class ProcessContext extends PluginContextBase<NodeJS.Process> implements IPluginContext<NodeJS.Process> {
  async getContext(): Promise<NodeJS.Process> {
    return process;
  }
}
