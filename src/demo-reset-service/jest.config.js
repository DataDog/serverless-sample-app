module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  // Transpile-only via @swc/jest. Type checking is handled separately by
  // `npm run typecheck` (tsc --noEmit), so tests do not need the TypeScript
  // compiler API. This also decouples the test runner from the TypeScript
  // version, which ts-jest pins to <7.
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript' },
          target: 'es2020',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
};
