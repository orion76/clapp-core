import { ILoggerConfig } from '@orion76/logger';
import { ULoggerNames } from '../types';

export const APP_LOGGERS_CONFIG: Record<ULoggerNames, ILoggerConfig> = {
  clapp_cli: {
    enabled: false,
    levels: ['info', 'log', 'warn', 'error'],
  },
};
