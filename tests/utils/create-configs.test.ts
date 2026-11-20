import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from '@jest/globals';

import type {
  IPluginDiscoveryConfig,
  ISchemaConfig,
  TCliConfigCustom,
  UPluginSourceConfig,
} from '@clapp/common';

import { createAppConfig } from '../../src/utils/create-configs.js';

/** Config override without the optional sections: the base every case extends. */
const BASE_OVERRIDE: TCliConfigCustom = { name: 'test-app', description: 'test', version: '0.0.0' };

const APP_ROOT = '/virtual/app-root';
const PROJECT_ROOT = '/virtual/project-root';

const temporaryDirs: string[] = [];

afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Creates a throwaway application root with an installed package inside its `node_modules`.
 * @param library Package name to install
 * @returns Real path of the application root
 */
function createAppRootWithLibrary(library: string): string {
  const tmpDir = join(process.cwd(), 'tmp');
  mkdirSync(tmpDir, { recursive: true });

  const appRoot = mkdtempSync(join(tmpDir, 'create-configs-'));
  temporaryDirs.push(appRoot);

  const libraryDir = join(appRoot, 'node_modules', library);
  mkdirSync(libraryDir, { recursive: true });
  writeFileSync(join(libraryDir, 'package.json'), JSON.stringify({ name: library, version: '0.0.0' }));

  return realpathSync(appRoot);
}

/**
 * Builds an override that declares only the schema section.
 * @param schemas Schema section as a config file declares it
 * @returns Override of the test application
 */
function overrideWithSchemas(schemas: ISchemaConfig): TCliConfigCustom {
  return { ...BASE_OVERRIDE, schemas };
}

describe('createAppConfig: the schemas section', () => {
  it('keeps an absent section default: no sources and no formatter mappings', () => {
    const config = createAppConfig(BASE_OVERRIDE, APP_ROOT);

    expect(config.schemas).toEqual({ sources: [], formatters: {} });
  });

  it('keeps the declared formatter map', () => {
    const schemas: ISchemaConfig = { sources: [], formatters: { 'task-list': 'table', brief: 'ordered-list' } };

    const config = createAppConfig(overrideWithSchemas(schemas), APP_ROOT);

    expect(config.schemas.formatters).toEqual({ 'task-list': 'table', brief: 'ordered-list' });
  });

  it('replaces the default section instead of merging into it', () => {
    const schemas: ISchemaConfig = { sources: [], formatters: { 'task-list': 'table' } };

    const withSchemas = createAppConfig(overrideWithSchemas(schemas), APP_ROOT);
    const withoutSchemas = createAppConfig(BASE_OVERRIDE, APP_ROOT);

    expect(withoutSchemas.schemas.formatters).toEqual({});
    expect(withSchemas.schemas.formatters).toEqual({ 'task-list': 'table' });
  });

  it('rejects a section that is not a mapping', () => {
    const schemas = 'task-list: table' as unknown as ISchemaConfig;

    expect(() => createAppConfig(overrideWithSchemas(schemas), APP_ROOT)).toThrow(
      'Invalid "schemas" section: expected a mapping with "sources" and "formatters".',
    );
  });

  it('rejects a sources value that is not a list', () => {
    const schemas = { sources: {}, formatters: {} } as unknown as ISchemaConfig;

    expect(() => createAppConfig(overrideWithSchemas(schemas), APP_ROOT)).toThrow(
      '"sources" must be a list of schema sources',
    );
  });

  it('rejects a malformed source and names its position in the section', () => {
    const schemas = { sources: [{ type: 'appRoot', patterns: ['schemas/**/*.schema.yml'] }, 42], formatters: {} };

    expect(() => createAppConfig(overrideWithSchemas(schemas as unknown as ISchemaConfig), APP_ROOT)).toThrow(
      'Invalid the source 1 of "schemas": expected a mapping with "type", "patterns" and "disabled".',
    );
  });

  it('rejects an unknown source type', () => {
    const schemas = { sources: [{ type: 'monorepo', patterns: [] }], formatters: {} };
    const message = 'unknown source type "monorepo". Expected one of: appRoot, path, library, project.';

    expect(() => createAppConfig(overrideWithSchemas(schemas as unknown as ISchemaConfig), APP_ROOT)).toThrow(message);
  });

  it('requires the package name of a library source', () => {
    const schemas = { sources: [{ type: 'library', patterns: [] }], formatters: {} };

    expect(() => createAppConfig(overrideWithSchemas(schemas as unknown as ISchemaConfig), APP_ROOT)).toThrow(
      'a source of type "library" requires the "library" package name',
    );
  });

  it('requires the directory of a path source', () => {
    const schemas = { sources: [{ type: 'path', patterns: [] }], formatters: {} };

    expect(() => createAppConfig(overrideWithSchemas(schemas as unknown as ISchemaConfig), APP_ROOT)).toThrow(
      'a source of type "path" requires the "path" directory',
    );
  });

  it('rejects a formatter map that is not a mapping', () => {
    const schemas = { sources: [], formatters: ['table'] } as unknown as ISchemaConfig;

    expect(() => createAppConfig(overrideWithSchemas(schemas), APP_ROOT)).toThrow(
      'Invalid "formatters" of the "schemas" section',
    );
  });

  it('rejects an empty schema id', () => {
    const schemas: ISchemaConfig = { sources: [], formatters: { '': 'table' } };

    expect(() => createAppConfig(overrideWithSchemas(schemas), APP_ROOT)).toThrow(
      'a schema id must be a non-empty string',
    );
  });

  it('rejects an empty formatter id and names the schema key', () => {
    const schemas: ISchemaConfig = { sources: [], formatters: { 'task-list': '' } };

    expect(() => createAppConfig(overrideWithSchemas(schemas), APP_ROOT)).toThrow(
      'schema "task-list" must map to a non-empty formatter id',
    );
  });

  it('rejects a formatter id that is not a string and shows the value', () => {
    const schemas = { sources: [], formatters: { 'task-list': 7 } } as unknown as ISchemaConfig;

    expect(() => createAppConfig(overrideWithSchemas(schemas), APP_ROOT)).toThrow(
      'schema "task-list" must map to a non-empty formatter id, got 7',
    );
  });
});

describe('createAppConfig: resolution of the schema sources', () => {
  it('resolves an appRoot source against the application root', () => {
    const source: UPluginSourceConfig = { type: 'appRoot', patterns: ['schemas/**/*.schema.yml'] };

    const config = createAppConfig(overrideWithSchemas({ sources: [source], formatters: {} }), APP_ROOT);

    expect(config.schemas.sources).toEqual([
      { type: 'appRoot', patterns: [join(APP_ROOT, 'schemas/**/*.schema.yml')], disabled: [] },
    ]);
  });

  it('resolves the schema sources exactly like the plugin sources of a type', () => {
    const source: UPluginSourceConfig = { type: 'appRoot', patterns: ['schemas/**/*.schema.yml'] };
    const plugins: Record<string, IPluginDiscoveryConfig> = {
      command: { sources: [source] },
      'command-argument': { sources: [source] },
      context: { sources: [source] },
      formatter: { sources: [source] },
    };

    const config = createAppConfig(
      { ...BASE_OVERRIDE, plugins: plugins as TCliConfigCustom['plugins'], schemas: { sources: [source], formatters: {} } },
      APP_ROOT,
      PROJECT_ROOT,
    );

    expect(config.schemas.sources[0].patterns).toEqual(config.plugins.command.sources[0].patterns);
  });

  it('resolves a relative path source against the application root', () => {
    const source: UPluginSourceConfig = { type: 'path', path: '../plugins', patterns: ['schemas/**/*.schema.yml'] };

    const config = createAppConfig(overrideWithSchemas({ sources: [source], formatters: {} }), APP_ROOT);

    expect(config.schemas.sources[0].patterns).toEqual([resolve(APP_ROOT, '../plugins', 'schemas/**/*.schema.yml')]);
  });

  it('takes an absolute path source as is', () => {
    const source: UPluginSourceConfig = { type: 'path', path: '/opt/schemas', patterns: ['*.schema.yml'] };

    const config = createAppConfig(overrideWithSchemas({ sources: [source], formatters: {} }), APP_ROOT);

    expect(config.schemas.sources[0].patterns).toEqual([join('/opt/schemas', '*.schema.yml')]);
  });

  it('resolves a project source against the context project root', () => {
    const source: UPluginSourceConfig = { type: 'project', patterns: ['schemas/**/*.schema.yml'] };

    const config = createAppConfig(
      overrideWithSchemas({ sources: [source], formatters: {} }),
      APP_ROOT,
      PROJECT_ROOT,
    );

    expect(config.schemas.sources[0].patterns).toEqual([join(PROJECT_ROOT, 'schemas/**/*.schema.yml')]);
  });

  it('leaves a project source empty when the launcher runs outside a project', () => {
    const source: UPluginSourceConfig = { type: 'project', patterns: ['schemas/**/*.schema.yml'] };

    const config = createAppConfig(overrideWithSchemas({ sources: [source], formatters: {} }), APP_ROOT);

    expect(config.schemas.sources[0].patterns).toEqual([]);
  });

  it('resolves a library source against the installed package directory', () => {
    const appRoot = createAppRootWithLibrary('demo-schemas');
    const source: UPluginSourceConfig = {
      type: 'library',
      library: 'demo-schemas',
      patterns: ['schemas/**/*.schema.yml'],
    };

    const config = createAppConfig(overrideWithSchemas({ sources: [source], formatters: {} }), appRoot);

    expect(config.schemas.sources[0].patterns).toEqual([
      join(appRoot, 'node_modules', 'demo-schemas', 'schemas/**/*.schema.yml'),
    ]);
  });

  it('fails a library source whose package is not installed', () => {
    const source: UPluginSourceConfig = { type: 'library', library: '@clapp/absent', patterns: [] };

    expect(() => createAppConfig(overrideWithSchemas({ sources: [source], formatters: {} }), APP_ROOT)).toThrow(
      '@clapp/absent',
    );
  });
});
