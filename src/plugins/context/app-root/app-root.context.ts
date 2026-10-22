import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';
import { getProjectRoot } from '@clapp/utils';

import { PluginContextBase } from '../../../context/plugin-context.base';

@NodePlugin<IPluginContextDefinition<string>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'app-root',
  label: 'App root directory',
  dependencies: ['cwd', 'user-home'],
})
export class AppRootContext
  extends PluginContextBase<string, [string, string]>
  implements IPluginContext<string, [string, string]>
{
  async getContext(cwd: string, userHome: string): Promise<string> {
    const projectRoot = getProjectRoot(cwd, userHome);
    if (projectRoot === null) {
      throw new Error(`Project root not found. cwd:${cwd}, userHome:${userHome}`);
    }
    return projectRoot;
  }
}
