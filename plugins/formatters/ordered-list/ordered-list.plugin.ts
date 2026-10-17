import { injectable } from 'inversify';
import { NodePlugin } from '@orion76/node-plugin';

import { PLUGIN_FORMATTER_TYPE, type IPluginFormatterDefinitionData } from '@clapp/common';
import type { IOrderedListData } from '@clapp/command';

import { PluginFormatterBase } from '../../../src/formatters/formatter.base';
import { renderOrderedList } from './lib';

/**
 * Formatter plugin that renders a todo-shaped list: a title, an optional
 * description and numbered or bulleted items.
 */
@NodePlugin<IPluginFormatterDefinitionData<'ordered-list'>>({
  type: PLUGIN_FORMATTER_TYPE,
  id: 'ordered-list',
  label: 'Ordered list',
  kind: 'ordered-list',
})
@injectable()
export class OrderedListFormatterPlugin extends PluginFormatterBase<IOrderedListData> {
  /**
   * Renders the list.
   * @param data List data
   * @returns List ready for the terminal
   */
  async format(data: IOrderedListData): Promise<string> {
    return renderOrderedList(data);
  }
}
