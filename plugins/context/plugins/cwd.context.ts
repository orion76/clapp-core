import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';

import { PluginContextBase } from '../../../src/context/plugin-context.base';

@NodePlugin<IPluginContextDefinition<string>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'cwd',
  label: 'App CWD',
  dependencies: ['process'],
})
export class CwdContext extends PluginContextBase<string> implements IPluginContext<string, [NodeJS.Process]> {
  getContext(process: NodeJS.Process): Promise<string> {
    return Promise.resolve(process.cwd());
  }
}
