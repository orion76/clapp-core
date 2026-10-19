import { readFileSync } from 'node:fs';
import path from 'node:path';

import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_CONTEXT_TYPE, type IPluginContext, type IPluginContextDefinition } from '@clapp/common';
import { getProjectRoot } from '@clapp/utils';

import { PluginContextBase } from '../../../context/plugin-context.base';

/**
 * Root of the context project, or `null` when there is none.
 *
 * The rule is the one of the `app-root` context (`getProjectRoot` of
 * `@clapp/utils`), but a failure is not fatal here: a working directory outside
 * the searched tree or a missing project only makes the context empty.
 *
 * @param cwd Working directory the lookup starts from
 * @param userHome Directory the lookup is bounded by
 * @returns Root of the context project, or `null`
 */
function resolveProjectRoot(cwd: string, userHome: string): string | null {
  try {
    return getProjectRoot(cwd, userHome);
  } catch {
    return null;
  }
}

/**
 * Reads the `name` of the `package.json` of the given project root.
 *
 * @param projectRoot Root of the context project
 * @returns Package name, or an empty string when the file is unreadable or has no `name`
 */
function readProjectName(projectRoot: string): string {
  try {
    const contents = readFileSync(path.join(projectRoot, 'package.json'), 'utf8');
    const packageJson = JSON.parse(contents) as { name?: unknown };
    const name = packageJson.name;

    return typeof name === 'string' ? name : '';
  } catch {
    return '';
  }
}

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
  dependencies: ['cwd', 'user-home'],
})
export class ProjectContext extends PluginContextBase<string, [string, string]> implements IPluginContext<string, [string, string]> {
  async getContext(cwd: string, userHome: string): Promise<string> {
    const projectRoot = resolveProjectRoot(cwd, userHome);

    if (projectRoot === null) {
      return '';
    }

    return readProjectName(projectRoot);
  }
}
