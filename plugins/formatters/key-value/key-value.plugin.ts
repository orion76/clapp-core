import { injectable } from 'inversify';
import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_FORMATTER_TYPE, type IPluginFormatterDefinitionData } from '@clapp/common';
import type { IKeyValueData } from '@clapp/command';

import { PluginFormatterBase } from '../../../src/formatters/formatter.base';
import { renderKeyValue } from './lib';

/**
 * Formatter plugin that renders field data as aligned key-value pairs grouped
 * into titled sections.
 */
@NodePlugin<IPluginFormatterDefinitionData<'key-value'>>({
  type: PLUGIN_FORMATTER_TYPE,
  id: 'key-value',
  label: 'Key-value pairs',
  kind: 'key-value',
})
@injectable()
export class KeyValueFormatterPlugin extends PluginFormatterBase<IKeyValueData> {
  /**
   * Renders the pairs.
   * @param data Key-value data
   * @returns Blocks ready for the terminal
   */
  async format(data: IKeyValueData): Promise<string> {
    return renderKeyValue(data);
  }
}
