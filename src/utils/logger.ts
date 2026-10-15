import { ILoggerConfig, LoggerCollection, TLogger } from '@orion76/logger';
import { Container, ServiceIdentifier } from 'inversify';
import { LOGGER_COLLECTION_TOKEN } from '../public-api';
import { ULoggerNames } from '../types';

export function loggerCollectionBind<Names extends ULoggerNames>(container: Container) {
  container
    .bind(LOGGER_COLLECTION_TOKEN)
    .to(LoggerCollection<Names>)
    .inSingletonScope();
}

export function loggerBind(
  name: ULoggerNames,
  config: ILoggerConfig,
  container: Container,
  token: ServiceIdentifier<TLogger>,
) {
  container.get(LOGGER_COLLECTION_TOKEN).add(name, config);

  container.bind(token).toDynamicValue((container) => {
    return container.get(LOGGER_COLLECTION_TOKEN).get(name);
  });
}
