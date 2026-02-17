import { LoggerCollection, TLogger, ILoggerConfig, UConsoleLevels } from '@orion76/logger';

type UNames = 'clapp_cli' | 'command_discovery';

const levels: UConsoleLevels[] = ['info', 'log', 'warn', 'error'];

const clappLoggerConfig: ILoggerConfig<UNames, UConsoleLevels>[] = [
    {
        name: 'clapp_cli',
        enabled: false,
        levels,
        enabledLevels: levels,
    },
    {
        name: 'command_discovery',
        enabled: false,
        levels,
        enabledLevels: levels,
    },
];
const loggerCollections = new LoggerCollection<UNames, UConsoleLevels>(clappLoggerConfig);

export function getLogger(name: UNames): TLogger<UConsoleLevels> {
    return loggerCollections.get(name);
}
