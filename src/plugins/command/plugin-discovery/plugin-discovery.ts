import { PluginDiscoveryBase } from '@orion76/plugin';
import * as fs from 'fs';
import * as path from 'path';

import { IPluginCommandDefinition, PLUGIN_COMMAND_TYPE } from '@clapp/command';
import { getProjectRoot, getUserProfileDirectory, isString, loadPackageJson } from '@clapp/utils';
import { getLogger } from '../../../logger-init';
import { IPluginDiscoveryConfig } from '../../../types';
import { getStartDirectories } from './utils';

const logger = getLogger('command_discovery');

/**
 * Plugin discovery for commands
 * Loads command configurations from files and converts them to plugin definitions
 */
export class CommandPluginDiscovery extends PluginDiscoveryBase<IPluginCommandDefinition> {
  type = PLUGIN_COMMAND_TYPE;
  protected definitions: IPluginCommandDefinition[] = [];

  constructor(
    private projects: string[],
    private config: IPluginDiscoveryConfig
  ) {
    super();
    // Don't load definitions in constructor anymore
  }

  async initialize(): Promise<void> {
    this.definitions = await this.findDefinitions();
  }

  async findDefinitions(): Promise<IPluginCommandDefinition[]> {
    const definitionFiles = this.findDefinitionFileNames();
    logger.send(['++ [CLAPP] commands\n', definitionFiles.join('\n')]);

    // Load all definitions asynchronously
    const configPromises = definitionFiles.map((filePath) => this.loadModuleFromFile(filePath));

    const configs = await Promise.all(configPromises);

    function filterEmpty(config: IPluginCommandDefinition | null): config is IPluginCommandDefinition {
      if (!config) {
        logger.send('Failed to load some command definitions', 'error');
        return false;
      }
      return true;
    }

    // Filter out null results
    const validConfigs = configs.filter(filterEmpty);

    if (validConfigs.length !== configs.length) {
      throw new Error('Some command definitions failed to load');
    }

    return validConfigs;
  }

  /**
   * Load command configuration from specific file using dynamic import
   * @param filePath Path to command file
   * @returns Command configuration or null
   */
  private async loadModuleFromFile(filePath: string): Promise<IPluginCommandDefinition | null> {
    try {
      // Convert to file URL for dynamic import
      const fileUrl = `file://${filePath}`;

      // Use dynamic import for ESM modules
      const module = await import(fileUrl);
      const config: IPluginCommandDefinition = module.default || module;

      return config;
    } catch (error) {
      console.error(`[ERROR] Error loading command from ${filePath}:`, (error as Error).message);
      console.error(`[ERROR] Stack:`, (error as Error).stack);
      return null;
    }
  }

  getCommandPaths(commandsDirectory: string): string[] {
    const searchDir = getUserProfileDirectory();
    const projects = [...this.projects, process.cwd()];
    const startDirectories = getStartDirectories(projects);
    logger.send(['Find commands', { searchDir, startDirectories, projects }]);

    const { isAvailableProjectCheck } = this.config;
    const commandPaths = startDirectories
      .map((startDirectory) => getProjectRoot(startDirectory, searchDir))
      .filter((projectRoot) => {
        const packageJson = loadPackageJson(path.join(projectRoot));
        return packageJson ? isAvailableProjectCheck(packageJson) : false;
      })
      .map((projectRoot) => {
        const commandPath = path.join(projectRoot, commandsDirectory);
        if (!fs.existsSync(commandPath)) {
          logger.send(['Command path not found:' + commandPath], 'warn');
          return;
        }
        return commandPath;
      })
      .filter(isString);
    logger.send(['COMMANDS', commandPaths]);
    return commandPaths;
  }

  findDefinitionFileNames(): string[] {
    const { commandsDirectory, commandFindFunc } = this.config;
    const definitionPaths: string[] = [];
    const commandPaths = this.getCommandPaths(commandsDirectory);

    commandPaths.forEach((commandPath) => {
      const fileNames = fs.readdirSync(commandPath, { encoding: 'utf8', recursive: true }).filter(commandFindFunc);
      const fullPaths = fileNames.map((fileName) => path.join(commandPath, fileName));
      definitionPaths.push(...fullPaths);
    });

    return definitionPaths;
  }
}
