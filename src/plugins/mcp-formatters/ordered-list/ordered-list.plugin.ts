import { injectable } from 'inversify';
import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_FORMATTER_TYPE, type IPluginFormatterDefinitionData } from '@clapp/common';
import type { IOrderedListData } from '@clapp/command';

import { PluginFormatterBase } from '../../../formatters/formatter.base';
import { renderOrderedList } from './lib';

/**
 * MCP formatter plugin that renders a todo-shaped list — a title, an optional
 * description and numbered or bulleted items — without terminal styling. It
 * carries the same id and kind as the terminal `ordered-list` formatter, but
 * writes for the protocol stream of an MCP server.
 */
@NodePlugin<IPluginFormatterDefinitionData<'ordered-list'>>({
  type: PLUGIN_FORMATTER_TYPE,
  id: 'ordered-list',
  label: 'Ordered list',
  kind: 'ordered-list',
})
@injectable()
export class MCPOrderedListFormatterPlugin extends PluginFormatterBase<IOrderedListData> {
  /**
   * Renders the list.
   * @param data List data
   * @returns List ready for the protocol stream
   */
  async format(data: IOrderedListData): Promise<string> {
    return renderOrderedList(data);
  }
}
