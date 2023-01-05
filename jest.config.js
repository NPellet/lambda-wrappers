module.exports = {
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./src/test_utils/setupTests.ts'],
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '<rootDir>/src/lambda/utils/secrets_manager_aws.ts',
    '<rootDir>/src/test_utils',
  ],
};
