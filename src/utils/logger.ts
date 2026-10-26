import { ULoggerNames } from '@clapp/common';
import { ILoggerConfig, LoggerCollection, TLogger, UConsoleLevels } from '@orion76/logger';
import { Container, ServiceIdentifier } from 'inversify';
import { LOGGER_COLLECTION_TOKEN } from '../public-api';


export function loggerCollectionBind(container: Container) {
  container
    .bind(LOGGER_COLLECTION_TOKEN)
    .to(LoggerCollection)
    .inSingletonScope();
}

export function loggerBind(
  name: ULoggerNames,
  config: ILoggerConfig<UConsoleLevels>,
  container: Container,
  token: ServiceIdentifier<TLogger>,
) {
  container.get(LOGGER_COLLECTION_TOKEN).add(name, config);

  container.bind(token).toDynamicValue((container) => {
    return container.get(LOGGER_COLLECTION_TOKEN).get(name);
  });
}
