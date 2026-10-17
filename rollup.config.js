import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';
import dts from 'rollup-plugin-dts';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import tsConfigPaths from 'rollup-plugin-tsconfig-paths';
import { createPackageJsonBaseContent } from '../../build/utils.js';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from './package.json' with { type: "json" };

const distRoot = 'dist'
const libName = 'core';
const bundleName = `clapp-${libName}`;

const NODE_EXTERNAL = ['fs', 'path', 'url'];
const RUNTIME_EXTERNAL = ['tsx/esm/api'];
const EXTERNAL = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies), ...NODE_EXTERNAL, ...RUNTIME_EXTERNAL]

/**
 * Tells whether an import stays out of the bundle.
 *
 * A name also covers its subpaths (`@modelcontextprotocol/server/stdio` for
 * `@modelcontextprotocol/server`) and the `node:` form of a builtin (`node:path` for `path`).
 * Without that the SDK subpath would be resolved from `node_modules` and bundled into the
 * output, and the builtin would be reported as an unresolved import.
 */
const isExternal = (id) =>
  EXTERNAL.some((name) => id === name || id === `node:${name}` || id.startsWith(`${name}/`));

/** Rollup plugins compiling the TypeScript sources of a JavaScript bundle. */
const createJsPlugins = () => [
  nodeResolve({
    resolveOnly: [],
    extensions: ['.ts', '.js'],
    preferBuiltins: false,
    browser: false
  }),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    declarationMap: false,
    inlineSources: false,

    exclude: ['node_modules/**']
  }),
];

export default [
  // JavaScript bundle
  {
    input: 'src/public-api.ts',
    output: {
      file: `${distRoot}/${bundleName}.js`,
      format: 'esm',

    },
    plugins: createJsPlugins(),
    external: isExternal
  },
  // MCP mode entry point — a bundle of its own, because the package ships it as a bin
  {
    input: 'src/bin/clapp-mcp.ts',
    output: {
      file: `${distRoot}/bin/clapp-mcp.js`,
      format: 'esm',
    },
    plugins: createJsPlugins(),
    external: isExternal
  },
  // TypeScript definitions bundle
  {
    input: 'src/public-api.ts',
    output: {
      file: `${distRoot}/${bundleName}.d.ts`,
      format: 'esm'
    },
    plugins: [
      dts()
    ],
    external: isExternal
  }
];
