import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';
import { getUserProfileDirectory } from '@clapp/utils';

import { PluginContextBase } from '../../../src/context/plugin-context.base';

@NodePlugin<IPluginContextDefinition<string>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'user-home',
  label: 'App user home directory',
})
export class UserHomeContext extends PluginContextBase<string> implements IPluginContext<string> {
  getContext(): Promise<string> {
    return Promise.resolve(getUserProfileDirectory());
  }
}
