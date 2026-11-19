import { IAppConfig, PLUGIN_COMMAND_ARGUMENT_TYPE, PLUGIN_COMMAND_TYPE, PLUGIN_CONTEXT_TYPE, PLUGIN_FORMATTER_TYPE } from '@clapp/common';
import { APP_LOGGERS_CONFIG } from './loggers';

export const APP_CONFIG_DEFAULT: IAppConfig = {
  name: 'clapp',
  description: 'CLI app',
  version: '',
  plugins: {
    [PLUGIN_COMMAND_TYPE]: { sources: [] },
    [PLUGIN_COMMAND_ARGUMENT_TYPE]: { sources: [] },
    [PLUGIN_CONTEXT_TYPE]: { sources: [] },
    [PLUGIN_FORMATTER_TYPE]: { sources: [] },
  },
  loggers: APP_LOGGERS_CONFIG,
  schemas: { sources: [], formatters: {} },
};
