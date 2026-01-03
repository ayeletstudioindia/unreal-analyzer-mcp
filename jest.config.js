/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^tree-sitter-cpp/bindings/node$': '<rootDir>/src/__tests__/__mocks__/tree-sitter-cpp.js',
    '^tree-sitter-cpp$': '<rootDir>/src/__tests__/__mocks__/tree-sitter-cpp.js',
    '^tree-sitter$': '<rootDir>/src/__tests__/__mocks__/tree-sitter.js',
    '^@modelcontextprotocol/sdk/server/index\\.js$': '<rootDir>/src/__tests__/__mocks__/@modelcontextprotocol/sdk/server/index.js',
    '^@modelcontextprotocol/sdk/server/stdio\\.js$': '<rootDir>/src/__tests__/__mocks__/@modelcontextprotocol/sdk/server/stdio.js',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  modulePathIgnorePatterns: ['<rootDir>/build'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/__mocks__/', 'setup.ts', '/build/']
};
