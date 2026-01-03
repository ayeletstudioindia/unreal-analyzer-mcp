#!/usr/bin/env node
/**
 * Created by Ayelet Technology Private Limited
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { UnrealCodeAnalyzer } from './analyzer.js';
import { GAME_GENRES, GameGenre, GenreFlag } from './types/game-genres.js';

const toolSchemas = {
  set_unreal_path: z.object({
    path: z.preprocess((val) => val ?? '', z.string().min(1, 'Path is required')),
  }),
  set_custom_codebase: z.object({
    path: z.preprocess((val) => val ?? '', z.string().min(1, 'Path is required')),
  }),
  analyze_class: z.object({
    className: z.preprocess((val) => val ?? '', z.string().min(1, 'Class name is required')),
  }),
  find_class_hierarchy: z.object({
    className: z.preprocess((val) => val ?? '', z.string().min(1, 'Class name is required')),
    includeImplementedInterfaces: z.boolean().optional().default(true),
  }),
  find_references: z.object({
    identifier: z.preprocess((val) => val ?? '', z.string().min(1, 'Identifier is required')),
    type: z.enum(['class', 'function', 'variable']),
  }),
  search_code: z.object({
    query: z.preprocess((val) => val ?? '', z.string().min(1, 'Query is required')),
    filePattern: z.string().optional().default('*.{h,cpp}'),
    includeComments: z.boolean().optional().default(true),
  }),
  analyze_subsystem: z.object({
    subsystem: z.enum([
      'Rendering',
      'Physics',
      'Audio',
      'Networking',
      'Input',
      'AI',
      'Animation',
      'UI',
    ]),
  }),
  query_api: z.object({
    query: z.preprocess((val) => val ?? '', z.string().min(1, 'Query is required')),
    category: z.enum(['Object', 'Actor', 'Structure', 'Component', 'Miscellaneous']).optional(),
    module: z.string().optional(),
    includeExamples: z.boolean().optional().default(true),
    maxResults: z.number().int().positive().optional().default(10),
  }),
  detect_patterns: z.object({
    filePath: z.preprocess((val) => val ?? '', z.string().min(1, 'File path is required')),
  }),
  get_best_practices: z.object({
    concept: z.enum(['UPROPERTY', 'UFUNCTION', 'Components', 'Events', 'Replication', 'Blueprints']),
  }),
} satisfies Record<string, z.ZodTypeAny>;

class UnrealAnalyzerServer {
  private server: Server;
  private analyzer: UnrealCodeAnalyzer;
  private autoInitPromise: Promise<void>;

  constructor() {
    this.server = new Server(
      {
        name: 'unreal-analyzer',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.analyzer = new UnrealCodeAnalyzer();
    this.autoInitPromise = this.initializeFromSettings();
    this.setupToolHandlers();
    
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async initializeFromSettings() {
    const unrealPath = process.env.UNREAL_ENGINE_PATH;
    const customCodebasePath = process.env.CUSTOM_CODEBASE_PATH;

    if (unrealPath) {
      try {
        await this.analyzer.initialize(unrealPath);
        return;
      } catch (error) {
        console.error('[MCP Config] Failed to initialize from UNREAL_ENGINE_PATH', error);
      }
    }

    if (customCodebasePath) {
      try {
        await this.analyzer.initializeCustomCodebase(customCodebasePath);
        return;
      } catch (error) {
        console.error('[MCP Config] Failed to initialize from CUSTOM_CODEBASE_PATH', error);
      }
    }

    const configPath = process.env.UNREAL_ANALYZER_CONFIG ?? path.join(process.cwd(), 'unreal-analyzer.config.json');
    try {
      const raw = await readFile(configPath, 'utf8');
      const config = JSON.parse(raw);
      if (config?.unrealPath) {
        await this.analyzer.initialize(config.unrealPath);
        return;
      }
      if (config?.customCodebasePath) {
        await this.analyzer.initializeCustomCodebase(config.customCodebasePath);
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.error('[MCP Config] Failed to load config file', error);
      }
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'set_unreal_path',
          description: 'Set the path to Unreal Engine source code',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to Unreal Engine source directory',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'set_custom_codebase',
          description: 'Set the path to a custom C++ codebase for analysis',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to custom codebase directory',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'analyze_class',
          description: 'Get detailed information about a C++ class',
          inputSchema: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                description: 'Name of the class to analyze',
              },
            },
            required: ['className'],
          },
        },
        {
          name: 'find_class_hierarchy',
          description: 'Get the inheritance hierarchy for a class',
          inputSchema: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                description: 'Name of the class to analyze',
              },
              includeImplementedInterfaces: {
                type: 'boolean',
                description: 'Whether to include implemented interfaces',
                default: true,
              },
            },
            required: ['className'],
          },
        },
        {
          name: 'find_references',
          description: 'Find all references to a class, function, or variable',
          inputSchema: {
            type: 'object',
            properties: {
              identifier: {
                type: 'string',
                description: 'Name of the symbol to find references for',
              },
              type: {
                type: 'string',
                description: 'Type of symbol (class, function, variable)',
                enum: ['class', 'function', 'variable'],
              },
            },
            required: ['identifier'],
          },
        },
        {
          name: 'search_code',
          description: 'Search through code with context',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (supports regex)',
              },
              filePattern: {
                type: 'string',
                description: 'File pattern to search in (e.g. *.h, *.cpp)',
                default: '*.{h,cpp}',
              },
              includeComments: {
                type: 'boolean',
                description: 'Whether to include comments in search',
                default: true,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'detect_patterns',
          description: 'Detect Unreal Engine patterns and suggest improvements',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the file to analyze',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'get_best_practices',
          description: 'Get Unreal Engine best practices and documentation for a specific concept',
          inputSchema: {
            type: 'object',
            properties: {
              concept: {
                type: 'string',
                description: 'Concept to get best practices for (e.g. UPROPERTY, Components, Events)',
                enum: ['UPROPERTY', 'UFUNCTION', 'Components', 'Events', 'Replication', 'Blueprints'],
              },
            },
            required: ['concept'],
          },
        },
        {
          name: 'analyze_subsystem',
          description: 'Analyze a specific Unreal Engine subsystem',
          inputSchema: {
            type: 'object',
            properties: {
              subsystem: {
                type: 'string',
                description: 'Name of the subsystem (e.g. Rendering, Physics)',
                enum: [
                  'Rendering',
                  'Physics',
                  'Audio',
                  'Networking',
                  'Input',
                  'AI',
                  'Animation',
                  'UI',
                ],
              },
            },
            required: ['subsystem'],
          },
        },
        {
          name: 'query_api',
          description: 'Search and retrieve Unreal Engine API documentation',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for API documentation',
              },
              category: {
                type: 'string',
                description: 'Filter by category (Object, Actor, Structure, Component)',
                enum: ['Object', 'Actor', 'Structure', 'Component', 'Miscellaneous'],
              },
              module: {
                type: 'string',
                description: 'Filter by module (Core, RenderCore, etc.)',
              },
              includeExamples: {
                type: 'boolean',
                description: 'Include code examples in results',
                default: true,
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const rawArgs = request.params.arguments ?? {};
      const validator = toolSchemas[toolName as keyof typeof toolSchemas];
      const args = validator ? validator.parse(rawArgs) : rawArgs;

      // Only check for initialization for analysis tools
      const analysisTools = ['analyze_class', 'find_class_hierarchy', 'find_references', 'search_code', 'analyze_subsystem', 'query_api'];
      if (analysisTools.includes(toolName) && !this.analyzer.isInitialized() && 
          toolName !== 'set_unreal_path' && toolName !== 'set_custom_codebase') {
        throw new Error('No codebase initialized. Use set_unreal_path or set_custom_codebase first.');
      }

      switch (toolName) {
        case 'detect_patterns':
          return this.handleDetectPatterns(args);
        case 'get_best_practices':
          return this.handleGetBestPractices(args);
        case 'set_unreal_path':
          return this.handleSetUnrealPath(args);
        case 'set_custom_codebase':
          return this.handleSetCustomCodebase(args);
        case 'analyze_class':
          return this.handleAnalyzeClass(args);
        case 'find_class_hierarchy':
          return this.handleFindClassHierarchy(args);
        case 'find_references':
          return this.handleFindReferences(args);
        case 'search_code':
          return this.handleSearchCode(args);
        case 'analyze_subsystem':
          return this.handleAnalyzeSubsystem(args);
        case 'query_api':
          return this.handleQueryApi(args);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    });
  }

  private async handleSetUnrealPath(args: any) {
    try {
      await this.analyzer.initialize(args.path);
      return {
        content: [
          {
            type: 'text',
            text: `Successfully set Unreal Engine path to: ${args.path}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to set Unreal Engine path');
    }
  }

  private async handleSetCustomCodebase(args: any) {
    try {
      await this.analyzer.initializeCustomCodebase(args.path);
      return {
        content: [
          {
            type: 'text',
            text: `Successfully set custom codebase path to: ${args.path}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to set custom codebase path');
    }
  }

  private async handleAnalyzeClass(args: any) {
    try {
      const classInfo = await this.analyzer.analyzeClass(args.className);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(classInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to analyze class');
    }
  }

  private async handleFindClassHierarchy(args: any) {
    try {
      const hierarchy = await this.analyzer.findClassHierarchy(
        args.className,
        args.includeImplementedInterfaces
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(hierarchy, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to find class hierarchy');
    }
  }

  private async handleFindReferences(args: any) {
    try {
      const references = await this.analyzer.findReferences(
        args.identifier,
        args.type
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(references, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to find references');
    }
  }

  private async handleSearchCode(args: any) {
    try {
      const results = await this.analyzer.searchCode(
        args.query,
        args.filePattern,
        args.includeComments
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to search code');
    }
  }

  private async handleDetectPatterns(args: any) {
    try {
      const fileContent = await readFile(args.filePath, 'utf8');
      const patterns = await this.analyzer.detectPatterns(fileContent, args.filePath);
      
      // Format the output to be more readable in Cline
      const formattedPatterns = patterns.map(match => {
        return {
          pattern: match.pattern.name,
          description: match.pattern.description,
          location: `${match.file}:${match.line}`,
          context: match.context,
          improvements: match.suggestedImprovements?.join('\n'),
          documentation: match.pattern.documentation,
          bestPractices: match.pattern.bestPractices.join('\n'),
          examples: match.pattern.examples.join('\n'),
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedPatterns, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to detect patterns');
    }
  }

  private async handleGetBestPractices(args: any) {
    const bestPractices: { [key: string]: any } = {
      'UPROPERTY': {
        description: 'Property declaration for Unreal reflection system',
        bestPractices: [
          'Use appropriate specifiers (EditAnywhere, BlueprintReadWrite)',
          'Consider replication needs (Replicated, ReplicatedUsing)',
          'Group related properties with categories',
          'Use Meta tags for validation and UI customization',
        ],
        examples: [
          'UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")\nfloat Health;',
          'UPROPERTY(Replicated, Meta = (ClampMin = "0.0"))\nfloat Speed;',
        ],
        documentation: 'https://docs.unrealengine.com/5.0/en-US/unreal-engine-uproperty-specifier-reference/',
      },
      'UFUNCTION': {
        description: 'Function declaration for Unreal reflection system',
        bestPractices: [
          'Use BlueprintCallable for functions that can be called from Blueprints',
          'Use BlueprintPure for functions without side effects',
          'Consider using BlueprintNativeEvent for overridable functions',
          'Add categories and tooltips for better organization',
        ],
        examples: [
          'UFUNCTION(BlueprintCallable, Category = "Combat")\nvoid TakeDamage(float DamageAmount);',
          'UFUNCTION(BlueprintPure, Category = "Stats")\nfloat GetHealthPercentage() const;',
        ],
        documentation: 'https://docs.unrealengine.com/5.0/en-US/ufunctions-in-unreal-engine/',
      },
      'Components': {
        description: 'Component setup and management in Unreal Engine',
        bestPractices: [
          'Create components in constructor using CreateDefaultSubobject',
          'Set up component hierarchy properly',
          'Initialize component properties in constructor',
          'Consider component replication needs',
        ],
        examples: [
          'MeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));\nRootComponent = MeshComponent;',
          'CollisionComponent->SetupAttachment(RootComponent);',
        ],
        documentation: 'https://docs.unrealengine.com/5.0/en-US/components-in-unreal-engine/',
      },
      'Events': {
        description: 'Event handling and delegation in Unreal Engine',
        bestPractices: [
          'Bind events in BeginPlay and unbind in EndPlay',
          'Use weak pointers for delegate bindings',
          'Consider using BlueprintAssignable for Blueprint events',
          'Handle edge cases and null checks',
        ],
        examples: [
          'DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, float, NewHealth);',
          'OnHealthChanged.AddDynamic(this, &AMyActor::HandleHealthChanged);',
        ],
        documentation: 'https://docs.unrealengine.com/5.0/en-US/delegates-in-unreal-engine/',
      },
      'Replication': {
        description: 'Network replication in Unreal Engine',
        bestPractices: [
          'Mark properties with Replicated specifier',
          'Implement GetLifetimeReplicatedProps',
          'Use ReplicatedUsing for property change callbacks',
          'Consider replication conditions (COND_*)',
        ],
        examples: [
          'void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const;',
          'UPROPERTY(ReplicatedUsing = OnRep_Health)\nfloat Health;',
        ],
        documentation: 'https://docs.unrealengine.com/5.0/en-US/networking-overview-for-unreal-engine/',
      },
      'Blueprints': {
        description: 'Blueprint integration and exposure',
        bestPractices: [
          'Use appropriate function and property specifiers',
          'Organize functions and properties into categories',
          'Add tooltips and descriptions',
          'Consider Blueprint/C++ interaction patterns',
        ],
        examples: [
          'UCLASS(Blueprintable, BlueprintType)',
          'UFUNCTION(BlueprintImplementableEvent)',
        ],
        documentation: 'https://docs.unrealengine.com/5.0/en-US/blueprints-and-cpp-in-unreal-engine/',
      },
    };

    const concept = bestPractices[args.concept];
    if (!concept) {
      throw new Error(`Unknown concept: ${args.concept}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(concept, null, 2),
        },
      ],
    };
  }

  private async handleAnalyzeSubsystem(args: any) {
    try {
      const subsystemInfo = await this.analyzer.analyzeSubsystem(args.subsystem);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(subsystemInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to analyze subsystem');
    }
  }

  private async handleQueryApi(args: any) {
    try {
      const results = await this.analyzer.queryApiReference(args.query, {
        category: args.category,
        module: args.module,
        includeExamples: args.includeExamples,
        maxResults: args.maxResults,
      });

      // Format results for better readability
      const formattedResults = results.map(result => ({
        class: result.reference.className,
        description: result.reference.description,
        module: result.reference.module,
        category: result.reference.category,
        syntax: result.reference.syntax,
        examples: result.reference.examples,
        remarks: result.reference.remarks,
        documentation: result.learningResources[0]?.url,
        relevance: result.relevance,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to query API documentation');
    }
  }

  async run() {
    await this.autoInitPromise;
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Unreal Engine Analyzer MCP server running on stdio');
  }
}

const server = new UnrealAnalyzerServer();
if (process.env.NODE_ENV !== 'test') {
  server.run().catch(console.error);
}
