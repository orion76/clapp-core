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
  // and their scoped deps.
  transformIgnorePatterns: ['/node_modules/(?!inversify|@inversifyjs|@orion76)'],
  moduleNameMapper: {
    // Tests compile the sources directly: map the workspace packages to `src` so a
    // jest run does not depend on prebuilt `packages/*/dist` bundles.
    '^@clapp/common$': '<rootDir>/../common/src/index.ts',
    '^@clapp/utils$': '<rootDir>/../utils/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
