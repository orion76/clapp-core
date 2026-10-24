import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, PluginContextBase, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';
import { getProjectRoot } from '@clapp/utils';
import path from 'path';
import { getAppMeta } from '../../../app-meta';

@NodePlugin<IPluginContextDefinition<string>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'app-root',
  label: 'App root directory',
  dependencies: ['cwd', 'user-home'],
})
export class CurrentProjectContext extends PluginContextBase<string, [string, string]> implements IPluginContext<string, [string, string]> {
  async getContext(cwd: string, userHome: string): Promise<string> {
    const currentProjectRoot = getProjectRoot(cwd, userHome);
    if (currentProjectRoot === null) {
      throw new Error(`Project root not found. cwd:${cwd}, userHome:${userHome}`);
    }
    return currentProjectRoot;
  }
}
