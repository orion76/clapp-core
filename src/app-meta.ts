import process from 'node:process';
import { IAppMeta } from './types';
import { getProjectRoot, getUserProfileDirectory } from '@clapp/utils';

let appMeta: IAppMeta;

export function initAppMeta() {
  if (!appMeta) {
    const appPath = process.argv[1];
    const userHome = getUserProfileDirectory();
    const appRoot = getProjectRoot(appPath, userHome);
    if (!appRoot) {
      throw new Error(`The root folder of the application's cli was not found for some reason.`);
    }
    appMeta = {
      cwd: process.cwd(),
      appRoot,
      appPath,
      userHome,
    };
  }
}
export function getAppMeta() {
  if (!appMeta) {
    throw new Error(`App Meta not initialized yet.`);
  }
  return { ...appMeta };
}
