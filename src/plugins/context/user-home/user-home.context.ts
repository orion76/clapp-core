import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, PluginContextBase, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';
import { getAppMeta } from '../../../app-meta';

@NodePlugin<IPluginContextDefinition<string>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'user-home',
  label: 'App user home directory',
})
export class UserHomeContext extends PluginContextBase<string> implements IPluginContext<string> {
  async getContext(): Promise<string> {
    return getAppMeta().userHome;
  }
}
