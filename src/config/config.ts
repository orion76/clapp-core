import { PLUGIN_COMMAND_TYPE, PLUGIN_CONTEXT_TYPE } from '@clapp/common';
import { ICliConfig } from '../types';
import { APP_LOGGERS_CONFIG } from './loggers';

export const APP_CONFIG_DEFAULT: ICliConfig = {
  name: 'clapp',
  description: 'CLI app',
  version: '',
  plugins: {
    [PLUGIN_COMMAND_TYPE]: { patterns: [] },
    [PLUGIN_CONTEXT_TYPE]: { patterns: [] },
  },
  loggers: APP_LOGGERS_CONFIG,
};
