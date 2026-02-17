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

const NODE_EXTERNAL = ['fs', 'path'];
const EXTERNAL = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies), ...NODE_EXTERNAL]
export default [
  // JavaScript bundle
  {
    input: 'src/public-api.ts',
    output: {
      file: `${distRoot}/${bundleName}.js`,
      format: 'esm',

    },
    plugins: [
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
    ],
    external: EXTERNAL
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
    external: EXTERNAL
  }
];
