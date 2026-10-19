import { PLUGIN_COMMAND_TYPE, PLUGIN_CONTEXT_TYPE, PLUGIN_FORMATTER_TYPE } from '@clapp/common';
import { IAppConfig } from '../types';
import { APP_LOGGERS_CONFIG } from './loggers';

export const APP_CONFIG_DEFAULT: IAppConfig = {
  name: 'clapp',
  description: 'CLI app',
  version: '',
  plugins: {
    [PLUGIN_COMMAND_TYPE]: { sources: [], disabled: [] },
    [PLUGIN_CONTEXT_TYPE]: { sources: [], disabled: [] },
    [PLUGIN_FORMATTER_TYPE]: { sources: [], disabled: [] },
  },
  loggers: APP_LOGGERS_CONFIG,
};
