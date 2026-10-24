import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, PluginContextBase, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';
import { getProjectRoot } from '@clapp/utils';
import { getAppMeta } from '../../../app-meta';

@NodePlugin<IPluginContextDefinition<string>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'app-root',
  label: 'App root directory',
  dependencies: ['user-home'],
})
export class AppRootContext extends PluginContextBase<string, [string, string]> implements IPluginContext<string, [string, string]> {
  async getContext(userHome: string): Promise<string> {
    const { appPath } = getAppMeta();
    const appRoot = getProjectRoot(appPath, userHome);
    if (!appRoot) {
      throw new Error(`error receiving the appRoot`);
    }
    return appRoot;
  }
}
