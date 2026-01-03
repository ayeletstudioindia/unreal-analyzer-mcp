import { jest } from '@jest/globals';

export const handlerRegistry = new Map();

export const mockServerInstance = {
  setRequestHandler: jest.fn((schema, handler) => {
    handlerRegistry.set(schema, handler);
  }),
  connect: jest.fn(),
  close: jest.fn(),
  onerror: jest.fn(),
};

export const serverConstructorCalls = [];

export const Server = jest.fn(function Server() {
  serverConstructorCalls.push({
    config: arguments[0],
    options: arguments[1],
  });
  return mockServerInstance;
});
