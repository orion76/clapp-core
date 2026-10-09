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
  // inversify 8 ships ESM only; let ts-jest transpile it and its scoped deps.
  transformIgnorePatterns: ['/node_modules/(?!inversify|@inversifyjs)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
