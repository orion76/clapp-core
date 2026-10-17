import { injectable } from 'inversify';
import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_FORMATTER_TYPE, type IPluginFormatterDefinitionData } from '@clapp/common';
import type { IKeyValueData } from '@clapp/command';

import { PluginFormatterBase } from '../../../src/formatters/formatter.base';
import { renderKeyValue } from './lib';

/**
 * MCP formatter plugin that renders field data as aligned key-value pairs
 * grouped into titled sections, without terminal styling. It carries the same
 * id and kind as the terminal `key-value` formatter, but writes for the protocol
 * stream of an MCP server.
 */
@NodePlugin<IPluginFormatterDefinitionData<'key-value'>>({
  type: PLUGIN_FORMATTER_TYPE,
  id: 'key-value',
  label: 'Key-value pairs',
  kind: 'key-value',
})
@injectable()
export class MCPKeyValueFormatterPlugin extends PluginFormatterBase<IKeyValueData> {
  /**
   * Renders the pairs.
   * @param data Key-value data
   * @returns Blocks ready for the protocol stream
   */
  async format(data: IKeyValueData): Promise<string> {
    return renderKeyValue(data);
  }
}
