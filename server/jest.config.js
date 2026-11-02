/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/src/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 60000,
  verbose: true,
  forceExit: true,
};
