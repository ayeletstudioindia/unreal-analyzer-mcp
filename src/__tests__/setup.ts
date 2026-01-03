import { jest, beforeEach } from '@jest/globals';

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock implementations for tree-sitter-compat
export const mockRootNode = {
  hasError: jest.fn().mockReturnValue(false),
  descendantsOfType: jest.fn().mockReturnValue([]),
  children: [],
  startPosition: { row: 0, column: 0 },
  text: ''
};

export const mockTree = {
  rootNode: mockRootNode,
  hasError: jest.fn().mockReturnValue(false),
};

const mockParserInstance = {
  setLanguage: jest.fn(),
  parse: jest.fn().mockReturnValue(mockTree),
};

export const MockParserCJS = jest.fn(() => mockParserInstance);
export const mockCppLanguage = { name: 'cpp' };

export const mockQueryCtor = jest.fn(function MockQueryCtor(_lang: unknown, _pattern: string) {
  return {
    matches: jest.fn().mockReturnValue([]),
  };
});

export const mockGlob = {
  sync: jest.fn().mockReturnValue([])
};

export const mockFs = {
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(''),
  writeFileSync: jest.fn()
};
