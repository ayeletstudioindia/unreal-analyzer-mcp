/**
 * Created by Ayelet Technology Private Limited
 */

import type { Tree, SyntaxNode, Query, QueryCapture } from "./tree-sitter-compat.js";
import { ParserCJS, CPPLanguage, QueryCtor } from "./tree-sitter-compat.js";

import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

// Infer Language type from parser.setLanguage() without referencing Parser type names directly
type Language = Parameters<InstanceType<typeof ParserCJS>["setLanguage"]>[0];



interface ClassInfo {
  name: string;
  file: string;
  line: number;
  superclasses: string[];
  interfaces: string[];
  methods: MethodInfo[];
  properties: PropertyInfo[];
  comments: string[];
}

interface MethodInfo {
  name: string;
  returnType: string;
  parameters: ParameterInfo[];
  isVirtual: boolean;
  isOverride: boolean;
  visibility: 'public' | 'protected' | 'private';
  comments: string[];
  line: number;
}

interface ParameterInfo {
  name: string;
  type: string;
  defaultValue?: string;
}

interface PropertyInfo {
  name: string;
  type: string;
  visibility: 'public' | 'protected' | 'private';
  comments: string[];
  line: number;
}

interface CodeReference {
  file: string;
  line: number;
  column: number;
  context: string;
}

interface ClassHierarchy {
  className: string;
  superclasses: ClassHierarchy[];
  interfaces: string[];
}

interface SubsystemInfo {
  name: string;
  mainClasses: string[];
  keyFeatures: string[];
  dependencies: string[];
  sourceFiles: string[];
}

interface PatternInfo {
  name: string;
  description: string;
  bestPractices: string[];
  documentation: string;
  examples: string[];
  relatedPatterns: string[];
}

interface LearningResource {
  title: string;
  type: 'documentation' | 'tutorial' | 'video' | 'blog';
  url: string;
  description: string;
}

interface ApiReference {
  className: string;
  methodName?: string;
  propertyName?: string;
  description: string;
  syntax: string;
  parameters?: {
    name: string;
    type: string;
    description: string;
  }[];
  returnType?: string;
  returnDescription?: string;
  examples: string[];
  remarks: string[];
  relatedClasses: string[];
  category: string;
  module: string;
  version: string;
}

interface ApiQueryResult {
  reference: ApiReference;
  context: string;
  relevance: number;
  learningResources: LearningResource[];
}

interface CodePatternMatch {
  pattern: PatternInfo;
  file: string;
  line: number;
  context: string;
  suggestedImprovements?: string[];
  learningResources: LearningResource[];
}

export class UnrealCodeAnalyzer {
  private parser: InstanceType<typeof ParserCJS>;
  private cppLang: Language;
  private unrealPath: string | null = null;
  private customPath: string | null = null;
  private classCache: Map<string, ClassInfo> = new Map();
  private astCache: Map<string, Tree> = new Map();
  private queryCache: Map<string, Query> = new Map();
  private initialized: boolean = false;
  private readonly MAX_CACHE_SIZE = 1000;
  private cacheQueue: string[] = [];

  // Common query patterns
  private readonly QUERY_PATTERNS = {
    CLASS: `(class_specifier name: (type_identifier) @class_name body: (field_declaration_list) @class_body) @class`,
    FUNCTION: `(function_definition declarator: (function_declarator) @func)`,
    TYPE_IDENTIFIER: `(type_identifier) @id`,
    IDENTIFIER: `(identifier) @id`
  };

  constructor() {
    this.parser = new ParserCJS();
    this.cppLang = CPPLanguage as unknown as Language;
    this.parser.setLanguage(this.cppLang);

    // Pre-cache common queries
    for (const [key, pattern] of Object.entries(this.QUERY_PATTERNS)) {
      const query = new QueryCtor(this.cppLang, pattern) as Query;
      this.queryCache.set(key, query);
    }
  }
  private manageCache<T extends object>(cache: Map<string, T>, key: string, value: T): void {
    if (cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry using FIFO
      const oldestKey = this.cacheQueue.shift();
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, value);
    this.cacheQueue.push(key);
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async initialize(enginePath: string): Promise<void> {
    if (!fs.existsSync(enginePath)) {
      throw new Error('Invalid Unreal Engine path: Directory does not exist');
    }

    const engineDir = path.join(enginePath, 'Engine');
    if (!fs.existsSync(engineDir)) {
      throw new Error('Invalid Unreal Engine path: Engine directory not found');
    }

    this.unrealPath = enginePath;
    this.initialized = true;
    await this.buildInitialCache();
  }

  public async initializeCustomCodebase(customPath: string): Promise<void> {
    if (!fs.existsSync(customPath)) {
      throw new Error('Invalid custom codebase path: Directory does not exist');
    }

    this.customPath = customPath;
    this.initialized = true;
    await this.buildInitialCache();
  }

  private async buildInitialCache(): Promise<void> {
    if (!this.unrealPath && !this.customPath) {
      throw new Error('No valid path configured');
    }

    const paths = this.unrealPath
      ? [
        path.join(this.unrealPath, 'Engine/Source/Runtime/Core'),
        path.join(this.unrealPath, 'Engine/Source/Runtime/CoreUObject'),
      ]
      : [this.customPath!];

    // Process files in parallel batches
    const BATCH_SIZE = 10;
    for (const basePath of paths) {
      const files = glob.sync('**/*.h', { cwd: basePath, absolute: true });
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(file => this.parseFile(file)));
      }
    }
  }

  private async parseFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, "utf8");
    let tree = this.astCache.get(filePath);

    if (!tree || (tree as any).hasError?.()) {
      const parsed = this.parser.parse(content) as Tree | undefined;
      if (!parsed) return; // or throw new Error(...)
      tree = parsed;
      this.manageCache(this.astCache, filePath, tree);
    }

    // Tree is guaranteed here
    const treeNonNull = tree as Tree;

    let classQuery = this.queryCache.get("CLASS");
    if (!classQuery) {
      classQuery = new QueryCtor(this.cppLang, this.QUERY_PATTERNS.CLASS) as Query;
      this.queryCache.set("CLASS", classQuery);
    }

    const matches = classQuery.matches(treeNonNull.rootNode);

    for (const match of matches) {
      const classNode = match.captures.find((c: QueryCapture) => c.name === "class")?.node;
      const className = match.captures.find((c: QueryCapture) => c.name === "class_name")?.node.text;

      if (classNode && className) {
        const classInfo = await this.extractClassInfo(classNode, filePath);
        this.classCache.set(className, classInfo);
      }
    }
  }


  private async extractClassInfo(node: SyntaxNode, filePath: string): Promise<ClassInfo> {
    const classInfo: ClassInfo = {
      name: '',
      file: filePath,
      line: node.startPosition.row + 1,
      superclasses: [],
      interfaces: [],
      methods: [],
      properties: [],
      comments: [],
    };

    // Extract class name
    const nameNode = node.descendantsOfType('type_identifier')[0];
    if (nameNode) {
      classInfo.name = nameNode.text;
    }

    // Extract superclasses
    const baseClause = node.descendantsOfType('base_class_clause')[0];
    if (baseClause) {
      const baseClasses = baseClause.descendantsOfType('type_identifier');
      classInfo.superclasses = baseClasses.map(n => n.text);
    }

    // Extract methods and properties
    const body = node.descendantsOfType('field_declaration_list')[0];
    if (body) {
      for (const child of body.children) {
        if (child.type === 'function_definition') {
          const methodInfo = this.extractMethodInfo(child);
          if (methodInfo) {
            classInfo.methods.push(methodInfo);
          }
        } else if (child.type === 'field_declaration') {
          const propertyInfo = this.extractPropertyInfo(child);
          if (propertyInfo) {
            classInfo.properties.push(propertyInfo);
          }
        }
      }
    }

    return classInfo;
  }

  private extractMethodInfo(node: SyntaxNode): MethodInfo | null {
    const declarator = node.descendantsOfType('function_declarator')[0];
    if (!declarator) return null;

    const methodInfo: MethodInfo = {
      name: '',
      returnType: '',
      parameters: [],
      isVirtual: false,
      isOverride: false,
      visibility: 'public',
      comments: [],
      line: node.startPosition.row + 1,
    };

    // Extract method name
    const nameNode = declarator.descendantsOfType('identifier')[0];
    if (nameNode) {
      methodInfo.name = nameNode.text;
    }

    // Extract return type
    const returnTypeNode = node.descendantsOfType('type_identifier')[0];
    if (returnTypeNode) {
      methodInfo.returnType = returnTypeNode.text;
    }

    // Extract parameters
    const paramList = declarator.descendantsOfType('parameter_list')[0];
    if (paramList) {
      for (const param of paramList.descendantsOfType('parameter_declaration')) {
        const paramInfo = this.extractParameterInfo(param);
        if (paramInfo) {
          methodInfo.parameters.push(paramInfo);
        }
      }
    }

    return methodInfo;
  }

  private extractParameterInfo(node: SyntaxNode): ParameterInfo | null {
    const typeNode = node.descendantsOfType('type_identifier')[0];
    const nameNode = node.descendantsOfType('identifier')[0];

    if (!typeNode || !nameNode) return null;

    return {
      name: nameNode.text,
      type: typeNode.text,
    };
  }

  private extractPropertyInfo(node: SyntaxNode): PropertyInfo | null {
    const typeNode = node.descendantsOfType('type_identifier')[0];
    const nameNode = node.descendantsOfType('identifier')[0];

    if (!typeNode || !nameNode) return null;

    return {
      name: nameNode.text,
      type: typeNode.text,
      visibility: 'public',
      comments: [],
      line: node.startPosition.row + 1,
    };
  }

  public async analyzeClass(className: string): Promise<ClassInfo> {
    if (!this.initialized) {
      throw new Error('Analyzer not initialized');
    }

    // Check cache first
    const cachedInfo = this.classCache.get(className);
    if (cachedInfo) {
      return cachedInfo;
    }

    // Search for the class
    const searchPath = this.customPath || this.unrealPath;
    if (!searchPath) {
      throw new Error('No valid search path configured');
    }

    const files = glob.sync('**/*.h', {
      cwd: searchPath,
      absolute: true,
    });

    for (const file of files) {
      await this.parseFile(file);
      const classInfo = this.classCache.get(className);
      if (classInfo) {
        return classInfo;
      }
    }

    throw new Error(`Class not found: ${className}`);
  }

  public async findClassHierarchy(
    className: string,
    includeInterfaces: boolean = true
  ): Promise<ClassHierarchy> {
    const classInfo = await this.analyzeClass(className);

    const hierarchy: ClassHierarchy = {
      className: classInfo.name,
      superclasses: [],
      interfaces: includeInterfaces ? classInfo.interfaces : [],
    };

    // Recursively build superclass hierarchies
    await Promise.all(
      classInfo.superclasses.map(async (superclass) => {
        try {
          const superHierarchy = await this.findClassHierarchy(
            superclass,
            includeInterfaces
          );
          hierarchy.superclasses.push(superHierarchy);
        } catch (error) {
          // Superclass might not be found, skip it
          console.error(`Could not analyze superclass: ${superclass}`);
        }
      })
    );

    return hierarchy;
  }

  public async findReferences(
    identifier: string,
    type?: 'class' | 'function' | 'variable'
  ): Promise<CodeReference[]> {
    if (!this.initialized) {
      throw new Error('Analyzer not initialized');
    }

    const searchPath = this.customPath || this.unrealPath;
    if (!searchPath) {
      throw new Error('No valid search path configured');
    }

    const files = glob.sync('**/*.{h,cpp}', {
      cwd: searchPath,
      absolute: true,
    });

    // Process files in parallel with a concurrency limit
    const BATCH_SIZE = 10;
    const references: CodeReference[] = [];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const content = fs.readFileSync(file, 'utf8');
          let tree = this.astCache.get(file);

          if (!tree) {
            const parsed = this.parser.parse(content) as Tree | undefined;
            if (!parsed) return [];
            tree = parsed;
            this.manageCache(this.astCache, file, tree);
          }

          const treeNonNull = tree as Tree;

          // Use cached query if available
          const queryString = type === 'class'
            ? `(type_identifier) @id (#eq? @id "${identifier}")`
            : `(identifier) @id (#eq? @id "${identifier}")`;

          const cacheKey = `${type}-${identifier}`;
          let query = this.queryCache.get(cacheKey);

          if (!query) {
            query = new QueryCtor(this.cppLang, queryString) as Query;
            this.queryCache.set(cacheKey, query);
          }

          const matches = query.matches(tree.rootNode);
          return matches.map(match => {
            const node = match.captures[0].node;
            const startRow = node.startPosition.row;
            const lines = content.split('\n');
            const context = lines
              .slice(Math.max(0, startRow - 2), startRow + 3)
              .join('\n');

            return {
              file,
              line: startRow + 1,
              column: node.startPosition.column + 1,
              context,
            };
          });
        })
      );

      references.push(...batchResults.flat());
    }

    return references;
  }

  public async searchCode(
    query: string,
    filePattern: string = '*.{h,cpp}',
    includeComments: boolean = true
  ): Promise<CodeReference[]> {
    if (!this.initialized) {
      throw new Error('Analyzer not initialized');
    }

    if (!this.unrealPath) {
      throw new Error('No valid search path configured');
    }

    const results: CodeReference[] = [];
    const files = glob.sync(`**/${filePattern}`, {
      cwd: this.unrealPath,
      absolute: true,
    });

    const regex = new RegExp(query, 'gi');
    const BATCH_SIZE = 20;

    // Process files in parallel batches for better performance
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const refs: CodeReference[] = [];
          const content = fs.readFileSync(file, 'utf8');
          const lines = content.split('\n');

          // Use a single regex test per line for better performance
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Skip comment lines if not including comments
            if (!includeComments && (line.trim().startsWith('//') || line.trim().startsWith('/*'))) {
              continue;
            }

            if (regex.test(line)) {
              // Reset regex lastIndex after test
              regex.lastIndex = 0;

              const context = lines
                .slice(Math.max(0, i - 2), i + 3)
                .join('\n');

              refs.push({
                file,
                line: i + 1,
                column: line.indexOf(query) + 1,
                context,
              });
            }
          }
          return refs;
        })
      );

      results.push(...batchResults.flat());
    }

    return results;
  }

  private apiCache: Map<string, ApiReference> = new Map();

  private readonly UNREAL_PATTERNS: PatternInfo[] = [
    {
      name: 'UPROPERTY Macro',
      description: 'Property declaration for Unreal reflection system',
      bestPractices: [
        'Use appropriate property specifiers (EditAnywhere, BlueprintReadWrite, etc.)',
        'Consider replication needs (Replicated, ReplicatedUsing)',
        'Group related properties with categories'
      ],
      documentation: 'https://docs.unrealengine.com/5.0/en-US/unreal-engine-uproperty-specifier-reference/',
      examples: [
        'UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")\nfloat Health;',
        'UPROPERTY(Replicated)\nFVector Location;'
      ],
      relatedPatterns: ['UFUNCTION Macro', 'UCLASS Macro']
    },
    {
      name: 'Component Setup',
      description: 'Creating and initializing components in constructor',
      bestPractices: [
        'Create components in constructor',
        'Set default values in constructor',
        'Use CreateDefaultSubobject for components',
        'Set root component appropriately'
      ],
      documentation: 'https://docs.unrealengine.com/5.0/en-US/components-in-unreal-engine/',
      examples: [
        'RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));',
        'MeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));'
      ],
      relatedPatterns: ['Actor Initialization', 'Component Registration']
    },
    {
      name: 'Event Binding',
      description: 'Binding to delegate events and implementing event handlers',
      bestPractices: [
        'Bind events in BeginPlay',
        'Unbind events in EndPlay',
        'Use DECLARE_DYNAMIC_MULTICAST_DELEGATE for Blueprint exposure',
        'Consider weak pointer bindings for safety'
      ],
      documentation: 'https://docs.unrealengine.com/5.0/en-US/delegates-in-unreal-engine/',
      examples: [
        'OnHealthChanged.AddDynamic(this, &AMyActor::HandleHealthChanged);',
        'FScriptDelegate Delegate; Delegate.BindUFunction(this, "OnCustomEvent");'
      ],
      relatedPatterns: ['Delegate Declaration', 'Event Dispatching']
    }
  ];

  public async detectPatterns(
    fileContent: string,
    filePath: string
  ): Promise<CodePatternMatch[]> {
    const matches: CodePatternMatch[] = [];
    const lines = fileContent.split('\n');

    for (const pattern of this.UNREAL_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const context = lines
          .slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
          .join('\n');

        // Check for pattern examples
        if (pattern.examples.some(example =>
          line.includes(example.split('\n')[0]) ||
          this.isPatternMatch(line, pattern.name))) {

          const suggestedImprovements = this.analyzePotentialImprovements(
            context,
            pattern
          );

          const learningResources = this.getLearningResources(pattern);

          matches.push({
            pattern,
            file: filePath,
            line: i + 1,
            context,
            suggestedImprovements,
            learningResources
          });
        }
      }
    }

    return matches;
  }

  private isPatternMatch(line: string, patternName: string): boolean {
    const patternMatchers: { [key: string]: RegExp } = {
      'UPROPERTY Macro': /UPROPERTY\s*\([^)]*\)/,
      'Component Setup': /CreateDefaultSubobject\s*<[^>]+>\s*\(/,
      'Event Binding': /\.Add(Dynamic|Unique|Raw|Lambda)|BindUFunction/
    };

    return patternMatchers[patternName]?.test(line) || false;
  }

  private analyzePotentialImprovements(
    context: string,
    pattern: PatternInfo
  ): string[] {
    const improvements: string[] = [];

    switch (pattern.name) {
      case 'UPROPERTY Macro':
        if (!context.includes('Category')) {
          improvements.push('Consider adding a Category specifier for better organization');
        }
        if (context.includes('BlueprintReadWrite') && !context.includes('Meta')) {
          improvements.push('Consider adding Meta specifiers for validation');
        }
        break;

      case 'Component Setup':
        if (!context.includes('RootComponent') && context.includes('CreateDefaultSubobject')) {
          improvements.push('Consider setting up component hierarchy');
        }
        break;

      case 'Event Binding':
        if (!context.toLowerCase().includes('beginplay') && !context.toLowerCase().includes('endplay')) {
          improvements.push('Consider managing event binding/unbinding in BeginPlay/EndPlay');
        }
        break;
    }

    return improvements;
  }

  private getLearningResources(pattern: PatternInfo): LearningResource[] {
    const commonResources: LearningResource[] = [
      {
        title: 'Official Documentation',
        type: 'documentation',
        url: pattern.documentation,
        description: `Official Unreal Engine documentation for ${pattern.name}`
      },
      {
        title: 'Community Guide',
        type: 'tutorial',
        url: `https://unrealcommunity.wiki/${pattern.name.toLowerCase().replace(/\s+/g, '-')}`,
        description: 'Community-created guide with practical examples'
      }
    ];

    return commonResources;
  }

  public async queryApiReference(
    query: string,
    options: {
      category?: string;
      module?: string;
      includeExamples?: boolean;
      maxResults?: number;
    } = {}
  ): Promise<ApiQueryResult[]> {
    if (!this.initialized) {
      throw new Error('Analyzer not initialized');
    }

    const results: ApiQueryResult[] = [];
    const searchTerms = query.toLowerCase().split(/\s+/);

    // Search through parsed classes and their documentation
    for (const [className, classInfo] of this.classCache.entries()) {
      const apiRef = await this.getOrCreateApiReference(classInfo);
      if (!apiRef) continue;

      // Filter by category/module if specified
      if (options.category && apiRef.category !== options.category) continue;
      if (options.module && apiRef.module !== options.module) continue;

      // Calculate relevance score based on match quality
      const relevance = this.calculateApiRelevance(apiRef, searchTerms);
      if (relevance > 0) {
        const result: ApiQueryResult = {
          reference: apiRef,
          context: this.generateApiContext(apiRef, options.includeExamples),
          relevance,
          learningResources: this.getLearningResources({
            name: className,
            description: apiRef.description,
            bestPractices: apiRef.remarks,
            documentation: `https://dev.epicgames.com/documentation/en-us/unreal-engine/API/${apiRef.module}/${className}`,
            examples: apiRef.examples,
            relatedPatterns: apiRef.relatedClasses
          })
        };
        results.push(result);
      }
    }

    // Sort by relevance and limit results
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, options.maxResults || 10);
  }

  private async getOrCreateApiReference(classInfo: ClassInfo): Promise<ApiReference | null> {
    if (this.apiCache.has(classInfo.name)) {
      return this.apiCache.get(classInfo.name)!;
    }

    // Extract documentation from class comments and structure
    const apiRef: ApiReference = {
      className: classInfo.name,
      description: this.extractDescription(classInfo.comments),
      syntax: this.generateClassSyntax(classInfo),
      examples: this.extractExamples(classInfo.comments),
      remarks: this.extractRemarks(classInfo.comments),
      relatedClasses: [...classInfo.superclasses, ...classInfo.interfaces],
      category: this.determineCategory(classInfo),
      module: this.determineModule(classInfo.file),
      version: '5.0', // Default to latest version
    };

    this.apiCache.set(classInfo.name, apiRef);
    return apiRef;
  }

  private calculateApiRelevance(apiRef: ApiReference, searchTerms: string[]): number {
    let score = 0;
    const text = [
      apiRef.className,
      apiRef.description,
      apiRef.category,
      apiRef.module,
      ...apiRef.relatedClasses,
      ...apiRef.examples,
      ...apiRef.remarks
    ].join(' ').toLowerCase();

    for (const term of searchTerms) {
      if (apiRef.className.toLowerCase().includes(term)) score += 10;
      if (apiRef.category.toLowerCase().includes(term)) score += 5;
      if (apiRef.module.toLowerCase().includes(term)) score += 5;
      if (text.includes(term)) score += 2;
    }

    return score;
  }

  private generateApiContext(apiRef: ApiReference, includeExamples: boolean = false): string {
    let context = `${apiRef.className} - ${apiRef.description}\n`;
    context += `Module: ${apiRef.module}\n`;
    context += `Category: ${apiRef.category}\n\n`;
    context += `Syntax:\n${apiRef.syntax}\n`;

    if (includeExamples && apiRef.examples.length > 0) {
      context += '\nExamples:\n';
      context += apiRef.examples.map(ex => `${ex}\n`).join('\n');
    }

    return context;
  }

  private extractDescription(comments: string[]): string {
    // Extract the main description from comments
    const descLines = comments.filter(c =>
      !c.includes('@example') &&
      !c.includes('@remarks') &&
      !c.includes('@see')
    );
    return descLines.join(' ').replace(/\/\*|\*\/|\*|\s+/g, ' ').trim();
  }

  private extractExamples(comments: string[]): string[] {
    return comments
      .filter(c => c.includes('@example'))
      .map(c => c.replace(/@example\s*/, '').trim());
  }

  private extractRemarks(comments: string[]): string[] {
    return comments
      .filter(c => c.includes('@remarks'))
      .map(c => c.replace(/@remarks\s*/, '').trim());
  }

  private generateClassSyntax(classInfo: ClassInfo): string {
    let syntax = `class ${classInfo.name}`;
    if (classInfo.superclasses.length > 0) {
      syntax += ` : public ${classInfo.superclasses.join(', public ')}`;
    }
    return syntax;
  }

  private determineCategory(classInfo: ClassInfo): string {
    // Determine category based on class name and inheritance
    if (classInfo.name.startsWith('U')) return 'Object';
    if (classInfo.name.startsWith('A')) return 'Actor';
    if (classInfo.name.startsWith('F')) return 'Structure';
    if (classInfo.superclasses.some(s => s.includes('Component'))) return 'Component';
    return 'Miscellaneous';
  }

  private determineModule(filePath: string): string {
    // Extract module name from file path
    const parts = filePath.split(path.sep);
    const runtimeIndex = parts.indexOf('Runtime');
    if (runtimeIndex >= 0 && runtimeIndex + 1 < parts.length) {
      return parts[runtimeIndex + 1];
    }
    return 'Core';
  }

  public async analyzeSubsystem(subsystem: string): Promise<SubsystemInfo> {
    if (!this.initialized) {
      throw new Error('Analyzer not initialized');
    }

    if (!this.unrealPath) {
      throw new Error('Unreal Engine path not configured');
    }

    const subsystemInfo: SubsystemInfo = {
      name: subsystem,
      mainClasses: [],
      keyFeatures: [],
      dependencies: [],
      sourceFiles: [],
    };

    // Map subsystem names to their directories
    const subsystemDirs: { [key: string]: string } = {
      Rendering: 'Engine/Source/Runtime/RenderCore',
      Physics: 'Engine/Source/Runtime/PhysicsCore',
      Audio: 'Engine/Source/Runtime/AudioCore',
      Networking: 'Engine/Source/Runtime/Networking',
      Input: 'Engine/Source/Runtime/InputCore',
      AI: 'Engine/Source/Runtime/AIModule',
      Animation: 'Engine/Source/Runtime/AnimationCore',
      UI: 'Engine/Source/Runtime/UMG',
    };

    const subsystemDir = subsystemDirs[subsystem];
    if (!subsystemDir) {
      throw new Error(`Unknown subsystem: ${subsystem}`);
    }

    const fullPath = path.join(this.unrealPath, subsystemDir);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Subsystem directory not found: ${fullPath}`);
    }

    // Get all source files
    subsystemInfo.sourceFiles = glob.sync('**/*.{h,cpp}', {
      cwd: fullPath,
      absolute: true,
    });

    // Process files in parallel batches
    const BATCH_SIZE = 10;
    const headerFiles = subsystemInfo.sourceFiles.filter(f => f.endsWith('.h'));

    for (let i = 0; i < headerFiles.length; i += BATCH_SIZE) {
      const batch = headerFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (file) => {
        await this.parseFile(file);
        const content = fs.readFileSync(file, 'utf8');
        const tree = this.parser.parse(content);

        const classQuery = this.queryCache.get('CLASS');
        if (!classQuery) {
          return;
        }

        const matches = classQuery.matches(tree.rootNode);
        for (const match of matches) {
          const className = match.captures.find(
            (c: QueryCapture) => c.name === 'class_name'
          )?.node.text;
          if (className) {
            subsystemInfo.mainClasses.push(className);
          }
        }
      }));
    }

    return subsystemInfo;
  }
}
