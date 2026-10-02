import { PluginBuilderBaseAsync } from '@orion76/plugin';
import { IPluginContext, IPluginContextDefinition } from './types';

export class ContextPluginBuilder extends PluginBuilderBaseAsync<IPluginContext> {
  async build(definition: IPluginContextDefinition): Promise<IPluginContext> {
    const { pluginClass, id } = definition;
    if (!pluginClass) {
      throw new Error(`[Context plugin] "pluginClass" for plugin: ${id} is missing.`);
    }
    return new pluginClass(definition);
  }
}
