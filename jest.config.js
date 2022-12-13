module.exports = {
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./src/test_utils/setupTests.ts'],
  collectCoverage: true,
};
