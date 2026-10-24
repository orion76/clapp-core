import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, PluginContextBase, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';

import { resolveProjectRoot } from '@clapp/utils';
import { readProjectName } from './lib';

/**
 * Context plugin that contributes the name of the context project — the `name` of
 * the `package.json` in the project root. It is the identity a launcher needs to
 * tell in which project it runs (the plugins of the project come from
 * `plugins/**` of that same root).
 *
 * The plugin is based on the `app-root` context rule but never fails: no project
 * or no `name` yields an empty string. It depends on `cwd`/`user-home` (the
 * dependencies of `app-root`) instead of on `app-root` itself, because `app-root`
 * throws when the project is not found, and the launcher must stay usable outside
 * a project.
 */
@NodePlugin<IPluginContextDefinition<string>>({
  type: PLUGIN_CONTEXT_TYPE,
  id: 'project',
  label: 'Context project name',
  dependencies: ['current-project-path'],
})
export class ProjectContext extends PluginContextBase<string, [string, string]> implements IPluginContext<string, [string, string]> {
  async getContext(projectRoot: string): Promise<string> {
    if (projectRoot === null) {
      return '';
    }

    return readProjectName(projectRoot);
  }
}
