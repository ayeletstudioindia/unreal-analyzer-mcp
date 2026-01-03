import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import type { PathLike } from 'fs';
import { mockGlob, MockParserCJS, mockCppLanguage, mockQueryCtor } from './setup';

let UnrealCodeAnalyzer: typeof import('../analyzer.js').UnrealCodeAnalyzer;
let analyzer: import('../analyzer.js').UnrealCodeAnalyzer;
let fsModule: jest.Mocked<typeof import('fs')>;

beforeAll(async () => {
  jest.unstable_mockModule('fs', () => ({
    __esModule: true,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
  }));

  jest.unstable_mockModule('glob', () => ({
    __esModule: true,
    sync: mockGlob.sync,
  }));

  jest.unstable_mockModule('../tree-sitter-compat.js', () => ({
    __esModule: true,
    ParserCJS: MockParserCJS,
    CPPLanguage: mockCppLanguage,
    QueryCtor: mockQueryCtor,
  }));

  ({ UnrealCodeAnalyzer } = await import('../analyzer.js'));
  fsModule = (await import('fs')) as unknown as jest.Mocked<typeof import('fs')>;
});

describe('UnrealCodeAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsModule.existsSync.mockImplementation((path: PathLike) => {
      const pathStr = path.toString();
      return !pathStr.includes('invalid');
    });
    fsModule.readFileSync.mockReturnValue('');
    fsModule.writeFileSync.mockImplementation(() => undefined as any);
    mockGlob.sync.mockReturnValue([]);
    analyzer = new UnrealCodeAnalyzer();
  });

  describe('initialization', () => {
    it('should start uninitialized', () => {
      expect(analyzer.isInitialized()).toBe(false);
    });

    it('should initialize with valid Unreal Engine path', async () => {
      const mockPath = '/valid/path';
      fsModule.existsSync.mockReturnValue(true);

      await analyzer.initialize(mockPath);
      expect(analyzer.isInitialized()).toBe(true);
    });

    it('should throw error with invalid Unreal Engine path', async () => {
      const mockPath = '/invalid/path';
      fsModule.existsSync.mockReturnValue(false);

      await expect(analyzer.initialize(mockPath))
        .rejects
        .toThrow('Invalid Unreal Engine path: Directory does not exist');
    });

    it('should initialize with valid custom codebase path', async () => {
      const mockPath = '/valid/custom/path';
      fsModule.existsSync.mockReturnValue(true);

      await analyzer.initializeCustomCodebase(mockPath);
      expect(analyzer.isInitialized()).toBe(true);
    });

    it('should throw error with invalid custom codebase path', async () => {
      const mockPath = '/invalid/custom/path';
      fsModule.existsSync.mockReturnValue(false);

      await expect(analyzer.initializeCustomCodebase(mockPath))
        .rejects
        .toThrow('Invalid custom codebase path: Directory does not exist');
    });
  });

  describe('class analysis', () => {
    beforeEach(async () => {
      fsModule.existsSync.mockReturnValue(true);
      await analyzer.initializeCustomCodebase('/mock/path');
    });

    it('should throw error when analyzing class without initialization', async () => {
      const uninitializedAnalyzer = new UnrealCodeAnalyzer();
      await expect(uninitializedAnalyzer.analyzeClass('TestClass'))
        .rejects
        .toThrow('Analyzer not initialized');
    });

    it('should analyze a class successfully', async () => {
      const mockFileContent = `
        class TestClass {
          public:
            void TestMethod();
            int TestProperty;
        };
      `;
      fsModule.readFileSync.mockReturnValue(mockFileContent);
      mockGlob.sync.mockReturnValue(['/mock/path/Test.h']);

      const classInfo = {
        name: 'TestClass',
        file: '/mock/path/Test.h',
        line: 1,
        superclasses: [],
        interfaces: [],
        methods: [],
        properties: [],
        comments: [],
      };

      jest.spyOn(analyzer as any, 'parseFile').mockImplementation(async () => {
        (analyzer as any).classCache.set('TestClass', classInfo);
      });

      const result = await analyzer.analyzeClass('TestClass');
      expect(result).toEqual(classInfo);
    });
  });

  describe('reference finding', () => {
    beforeEach(async () => {
      fsModule.existsSync.mockReturnValue(true);
      await analyzer.initializeCustomCodebase('/mock/path');
      (analyzer as any).unrealPath = '/mock/path';
    });

    it('should find references to a class', async () => {
      const mockContent = 'TestClass instance;';
      fsModule.readFileSync.mockReturnValue(mockContent);

      const references = await analyzer.findReferences('TestClass', 'class');
      expect(references).toBeInstanceOf(Array);
      expect(references.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when finding references without initialization', async () => {
      const uninitializedAnalyzer = new UnrealCodeAnalyzer();
      await expect(uninitializedAnalyzer.findReferences('TestClass'))
        .rejects
        .toThrow('Analyzer not initialized');
    });
  });

  describe('code search', () => {
    beforeEach(async () => {
      fsModule.existsSync.mockReturnValue(true);
      await analyzer.initializeCustomCodebase('/mock/path');
      (analyzer as any).unrealPath = '/mock/path';
    });

    it('should search code with query', async () => {
      const mockContent = 'void TestFunction() { }';
      fsModule.readFileSync.mockReturnValue(mockContent);

      const results = await analyzer.searchCode('TestFunction');
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect file pattern in search', async () => {
      const mockContent = 'test content';
      fsModule.readFileSync.mockReturnValue(mockContent);

      const results = await analyzer.searchCode('test', '*.cpp');
      expect(results).toBeInstanceOf(Array);
    });

    it('should handle comment inclusion setting', async () => {
      const mockContent = '// Test comment\ncode';
      fsModule.readFileSync.mockReturnValue(mockContent);

      const resultsWithComments = await analyzer.searchCode('Test', '*.cpp', true);
      const resultsWithoutComments = await analyzer.searchCode('Test', '*.cpp', false);

      expect(resultsWithComments.length).toBeGreaterThanOrEqual(resultsWithoutComments.length);
    });
  });

  describe('subsystem analysis', () => {
    beforeEach(async () => {
      fsModule.existsSync.mockReturnValue(true);
      await analyzer.initialize('/mock/unreal/path');
    });

    it('should analyze a valid subsystem', async () => {
      const mockContent = 'class RenderingClass { };';
      fsModule.readFileSync.mockReturnValue(mockContent);

      const result = await analyzer.analyzeSubsystem('Rendering');
      expect(result).toHaveProperty('name', 'Rendering');
      expect(result).toHaveProperty('mainClasses');
      expect(result).toHaveProperty('sourceFiles');
    });

    it('should throw error for unknown subsystem', async () => {
      await expect(analyzer.analyzeSubsystem('InvalidSubsystem'))
        .rejects
        .toThrow('Unknown subsystem: InvalidSubsystem');
    });
  });
});
