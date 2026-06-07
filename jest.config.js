// jest.config.js
// Tests must ALL pass before deploying.
// Run: npx jest --verbose

module.exports = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }]
  },
  // Block deployment if any test fails
  bail: true,
  // Show each test name in output
  verbose: true,
}