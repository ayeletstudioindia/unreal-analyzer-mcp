import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  handlerRegistry,
  mockServerInstance,
  serverConstructorCalls,
} from './__mocks__/@modelcontextprotocol/sdk/server/index.js';

let listToolsHandler: Function | undefined;
let callToolHandler: Function | undefined;
let mockAnalyzerClass: any;
let consoleErrorSpy: any;

beforeAll(async () => {
  await jest.unstable_mockModule('../analyzer.js', () => {
    mockAnalyzerClass = jest.fn(function MockAnalyzer() {});
    Object.assign(mockAnalyzerClass.prototype, {
      initialize: jest.fn(),
      initializeCustomCodebase: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
      analyzeClass: jest.fn(),
      findClassHierarchy: jest.fn(),
      findReferences: jest.fn(),
      searchCode: jest.fn(),
      analyzeSubsystem: jest.fn(),
    });
    return { __esModule: true, UnrealCodeAnalyzer: mockAnalyzerClass };
  });

  await jest.unstable_mockModule('../tree-sitter-compat.js', () => ({
    __esModule: true,
    ParserCJS: jest.fn(() => ({
      setLanguage: jest.fn(),
      parse: jest.fn(() => ({
        rootNode: {
          hasError: jest.fn().mockReturnValue(false),
          descendantsOfType: jest.fn().mockReturnValue([]),
        },
      })),
    })),
    CPPLanguage: {},
    QueryCtor: class MockQueryCtor {
      constructor() {
        return { matches: jest.fn().mockReturnValue([]) };
      }
    },
  }));

  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await import('../index.js');
  listToolsHandler = handlerRegistry.get(ListToolsRequestSchema);
  callToolHandler = handlerRegistry.get(CallToolRequestSchema);
});

beforeEach(() => {
  mockAnalyzerClass.prototype.initialize.mockClear();
  mockAnalyzerClass.prototype.initializeCustomCodebase.mockClear();
  mockAnalyzerClass.prototype.isInitialized.mockClear();
  mockAnalyzerClass.prototype.isInitialized.mockReturnValue(true);
  mockAnalyzerClass.prototype.analyzeClass.mockClear();
  mockAnalyzerClass.prototype.findClassHierarchy.mockClear();
  mockAnalyzerClass.prototype.findReferences.mockClear();
  mockAnalyzerClass.prototype.searchCode.mockClear();
  mockAnalyzerClass.prototype.analyzeSubsystem.mockClear();
  mockServerInstance.connect.mockClear();
  mockServerInstance.close.mockClear();
  listToolsHandler = handlerRegistry.get(ListToolsRequestSchema);
  callToolHandler = handlerRegistry.get(CallToolRequestSchema);
});

afterAll(() => {
  consoleErrorSpy?.mockRestore();
});

function expectDefined<T>(value: T | undefined, name: string): asserts value is T {
  if (value === undefined) throw new Error(`${name} was not registered`);
}

describe('UnrealAnalyzerServer', () => {
  it('should initialize server with correct configuration', () => {
    expect(serverConstructorCalls[0]).toEqual({
      config: {
        name: 'unreal-analyzer',
        version: '0.1.0',
      },
      options: {
        capabilities: { tools: {} },
      },
    });
  });

  it('should set up error handler', () => {
    expect(mockServerInstance.onerror).toBeDefined();
  });

  it('should wire handlers with correct schemas', () => {
    expect(handlerRegistry.get(ListToolsRequestSchema)).toEqual(expect.any(Function));
    expect(handlerRegistry.get(CallToolRequestSchema)).toEqual(expect.any(Function));
  });

  describe('list_tools', () => {
    it('should expose expected tools', async () => {
      expectDefined(listToolsHandler, 'listToolsHandler');
      const result = await listToolsHandler();
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toEqual(
        expect.arrayContaining([
          'set_unreal_path',
          'set_custom_codebase',
          'analyze_class',
          'find_class_hierarchy',
          'find_references',
          'search_code',
          'detect_patterns',
          'get_best_practices',
          'analyze_subsystem',
          'query_api',
        ])
      );
    });
  });

  describe('call_tool routing', () => {
    const callTool = async (name: string, args: any) => {
      expectDefined(callToolHandler, 'callToolHandler');
      return await callToolHandler({ params: { name, arguments: args } });
    };

    it('routes set_unreal_path to analyzer.initialize', async () => {
      const path = '/tmp/unreal';
      await callTool('set_unreal_path', { path });
      expect(mockAnalyzerClass.prototype.initialize).toHaveBeenCalledWith(path);
    });

    it('routes analyze_class and returns analyzer result text', async () => {
      const info = { name: 'MyClass' };
      mockAnalyzerClass.prototype.isInitialized.mockReturnValue(true);
      mockAnalyzerClass.prototype.analyzeClass.mockResolvedValue(info);

      const res = await callTool('analyze_class', { className: 'MyClass' });
      expect(res.content[0].text).toBe(JSON.stringify(info, null, 2));
      expect(mockAnalyzerClass.prototype.analyzeClass).toHaveBeenCalledWith('MyClass');
    });

    it('throws for unknown tool', async () => {
      await expect(callTool('unknown_tool', {})).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('validates required path for set_unreal_path', async () => {
      await expect(callTool('set_unreal_path', {} as any)).rejects.toThrow(/path is required/i);
    });

    it('validates required className for analyze_class', async () => {
      await expect(callTool('analyze_class', {} as any)).rejects.toThrow(/class name is required/i);
    });
  });
});
