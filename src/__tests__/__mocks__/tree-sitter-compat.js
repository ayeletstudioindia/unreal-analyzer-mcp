import { jest } from '@jest/globals';

export const ParserCJS = jest.fn(() => ({
  setLanguage: jest.fn(),
  parse: jest.fn(() => ({
    rootNode: {
      hasError: jest.fn().mockReturnValue(false),
      descendantsOfType: jest.fn().mockReturnValue([]),
    },
  })),
}));

export const CPPLanguage = {};

export class QueryCtor {
  constructor() {
    return { matches: jest.fn().mockReturnValue([]) };
  }
}
