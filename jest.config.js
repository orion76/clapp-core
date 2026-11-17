/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  displayName: 'clapp-core',
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.tests.json',
      },
    ],
  },
  // inversify 8 and @orion76 packages ship ESM only; let ts-jest transpile them
  // and their scoped deps. Under pnpm the packages live in node_modules/.pnpm/...,
  // so the .pnpm node must be transformed too (its first path segment after
  // node_modules/ is `.pnpm`, which previously fell through to the ignore).
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm|inversify|@inversifyjs|@orion76)'],
  moduleNameMapper: {
    // Tests compile the sources directly: map the workspace packages to `src` so a
    // jest run does not depend on prebuilt `packages/*/dist` bundles.
    '^@clapp/common$': '<rootDir>/../common/src/index.ts',
    '^@clapp/utils$': '<rootDir>/../utils/src/index.ts',
    // `@orion76/*` sources live outside the workspace (sibling repository), and their
    // `exports` point to unbuilt `lib/`/`dist`, so they are mapped to `src` through the
    // root `node_modules` links.
    '^@orion76/node-plugin$': '<rootDir>/../../node_modules/@orion76/node-plugin/src/public-api.ts',
    '^@orion76/plugin$': '<rootDir>/../../node_modules/@orion76/plugin/src/public-api.ts',
    '^@orion76/logger$': '<rootDir>/../../node_modules/@orion76/logger/src/public-api.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
