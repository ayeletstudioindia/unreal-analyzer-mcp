[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/ayeletstudioindia-unreal-analyzer-mcp-badge.png)](https://mseep.ai/app/ayeletstudioindia-unreal-analyzer-mcp)

<!--
Created by Ayelet Technology Private Limited
-->

# Unreal Engine Code Analyzer MCP Server

A Model Context Protocol (MCP) server that provides powerful source code analysis capabilities for Unreal Engine codebases. This tool enables AI assistants like Claude and Cline to deeply understand and analyze Unreal Engine source code.


<a href="https://glama.ai/mcp/servers/z36022whws"><img width="380" height="200" src="https://glama.ai/mcp/servers/z36022whws/badge" alt="Unreal Engine Code Analyzer Server MCP server" /></a>

## Features

- **Class Analysis**: Get detailed information about C++ classes including methods, properties, and inheritance
- **Hierarchy Mapping**: Visualize and understand class inheritance hierarchies
- **Code Search**: Search through code with context-aware results
- **Reference Finding**: Locate all references to classes, functions, or variables
- **Subsystem Analysis**: Analyze major Unreal Engine subsystems like Rendering, Physics, etc.
- **Game Genre Knowledge**: Built-in knowledge base of game genres, features, and implementation patterns
- **Pattern Detection & Learning**: Identifies common Unreal Engine patterns and provides learning resources
- **Custom Codebase Support**: Analyze your own Unreal Engine project codebase


## Quick Start

## Installation

1. Clone this repository:
```bash
git clone https://github.com/ayeletstudioindia/unreal-analyzer-mcp
cd unreal-analyzer-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### For Claude Desktop App

Add the following to your Claude desktop configuration file (`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "unreal-analyzer": {
      "command": "node",
      "args": ["path/to/unreal-analyzer/build/index.js"],
      "env": {}
    }
  }
}
```

### For Cline

Add the following to your Cline MCP settings file (`%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` on Windows):

```json
{
  "mcpServers": {
    "unreal-analyzer": {
      "command": "node",
      "args": ["path/to/unreal-analyzer/build/index.js"],
      "env": {}
    }
  }
}
```

## Technical Details

The analyzer is built using:
- TypeScript for type-safe code
- Tree-sitter for robust C++ parsing
- Model Context Protocol SDK for AI assistant integration
- Glob for file pattern matching
- Zod for schema validation

Key dependencies:
- @modelcontextprotocol/sdk: ^1.25.1
- tree-sitter: ^0.21.1
- tree-sitter-cpp: ^0.23.4
- tree-sitter-wasms: ^0.1.13
- glob: ^13.0.0
- zod: ^4.3.4

## Usage

Before using any analysis tools, you must first set either the Unreal Engine source path or a custom codebase path:

### Setting Up Analysis

#### For Unreal Engine Source Code
```typescript
{
  "name": "set_unreal_path",
  "arguments": {
    "path": "/path/to/UnrealEngine/Source"
  }
}
```

#### For Custom C++ Codebases
```typescript
{
  "name": "set_custom_codebase",
  "arguments": {
    "path": "/path/to/your/codebase"
  }
}
```

The custom codebase feature allows you to analyze any C++ project. For example:
- Game engines (Unity, Godot, custom engines)
- Graphics libraries (OpenGL, Vulkan, DirectX)
- Frameworks (Qt, Boost, SFML)
- Any C++ application or library

Example analyzing a custom game engine:
```typescript
// Initialize with custom codebase
{
  "name": "set_custom_codebase",
  "arguments": {
    "path": "/path/to/game-engine"
  }
}

// Analyze engine's renderer class
{
  "name": "analyze_class",
  "arguments": {
    "className": "Renderer"
  }
}

// Find all shader-related code
{
  "name": "search_code",
  "arguments": {
    "query": "shader|glsl|hlsl",
    "filePattern": "*.{h,cpp,hpp}"
  }
}

// Get render system class hierarchy
{
  "name": "find_class_hierarchy",
  "arguments": {
    "className": "RenderSystem",
    "includeImplementedInterfaces": true
  }
}
```

Example analyzing a Qt application:
```typescript
// Initialize with Qt project
{
  "name": "set_custom_codebase",
  "arguments": {
    "path": "/path/to/qt-app"
  }
}

// Find widget class definitions
{
  "name": "search_code",
  "arguments": {
    "query": "class.*:.*public.*QWidget",
    "filePattern": "*.h"
  }
}

// Analyze main window class
{
  "name": "analyze_class",
  "arguments": {
    "className": "MainWindow"
  }
}

// Find signal/slot connections
{
  "name": "find_references",
  "arguments": {
    "identifier": "connect",
    "type": "function"
  }
}
```

### Available Tools

#### 1. Class Analysis
```typescript
// Get detailed information about the AActor class
{
  "name": "analyze_class",
  "arguments": {
    "className": "AActor"
  }
}
```
Example output:
```json
{
  "name": "AActor",
  "properties": [
    {
      "name": "RootComponent",
      "type": "USceneComponent*",
      "access": "protected"
    }
    // ... other properties
  ],
  "methods": [
    {
      "name": "BeginPlay",
      "returnType": "void",
      "access": "protected",
      "virtual": true
    }
    // ... other methods
  ]
}
```

#### 2. Class Hierarchy Analysis
```typescript
// Get the inheritance hierarchy for ACharacter
{
  "name": "find_class_hierarchy",
  "arguments": {
    "className": "ACharacter",
    "includeImplementedInterfaces": true
  }
}
```
Example output:
```json
{
  "class": "ACharacter",
  "inheritsFrom": "APawn",
  "interfaces": ["IMovementModeInterface"],
  "hierarchy": [
    "ACharacter",
    "APawn",
    "AActor",
    "UObject"
  ]
}
```

#### 3. Reference Finding
```typescript
// Find all references to the BeginPlay function
{
  "name": "find_references",
  "arguments": {
    "identifier": "BeginPlay",
    "type": "function"
  }
}
```
Example output:
```json
{
  "references": [
    {
      "file": "Actor.cpp",
      "line": 245,
      "context": "void AActor::BeginPlay() { ... }"
    },
    {
      "file": "Character.cpp",
      "line": 178,
      "context": "Super::BeginPlay();"
    }
  ]
}
```

#### 4. Code Search
```typescript
// Search for physics-related code
{
  "name": "search_code",
  "arguments": {
    "query": "PhysicsHandle",
    "filePattern": "*.h",
    "includeComments": true
  }
}
```
Example output:
```json
{
  "matches": [
    {
      "file": "PhysicsEngine/PhysicsHandleComponent.h",
      "line": 15,
      "context": "class UPhysicsHandleComponent : public UActorComponent",
      "snippet": "// Component used for grabbing and moving physics objects"
    }
  ]
}
```

#### 5. Pattern Detection & Best Practices

The analyzer provides two powerful tools for understanding and following Unreal Engine best practices:

##### Pattern Detection
```typescript
// Detect patterns in a file
{
  "name": "detect_patterns",
  "arguments": {
    "filePath": "Source/MyGame/MyActor.h"
  }
}
```
Example output:
```json
{
  "patterns": [
    {
      "pattern": "UPROPERTY Macro",
      "description": "Property declaration for Unreal reflection system",
      "location": "Source/MyGame/MyActor.h:15",
      "context": "UPROPERTY(EditAnywhere, BlueprintReadWrite)\nfloat Health;",
      "improvements": "Consider adding a Category specifier for better organization\nConsider adding Meta tags for validation",
      "documentation": "https://docs.unrealengine.com/5.0/en-US/unreal-engine-uproperty-specifier-reference/",
      "bestPractices": "Use appropriate specifiers (EditAnywhere, BlueprintReadWrite)\nConsider replication needs (Replicated, ReplicatedUsing)\nGroup related properties with categories",
      "examples": "UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = \"Combat\")\nfloat Health;\nUPROPERTY(Replicated, Meta = (ClampMin = \"0.0\"))\nfloat Speed;"
    }
  ]
}
```

##### Best Practices Guide
```typescript
// Get best practices for specific Unreal concepts
{
  "name": "get_best_practices",
  "arguments": {
    "concept": "UPROPERTY"  // or UFUNCTION, Components, Events, Replication, Blueprints
  }
}
```
Example output:
```json
{
  "description": "Property declaration for Unreal reflection system",
  "bestPractices": [
    "Use appropriate specifiers (EditAnywhere, BlueprintReadWrite)",
    "Consider replication needs (Replicated, ReplicatedUsing)",
    "Group related properties with categories",
    "Use Meta tags for validation and UI customization"
  ],
  "examples": [
    "UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = \"Combat\")\nfloat Health;",
    "UPROPERTY(Replicated, Meta = (ClampMin = \"0.0\"))\nfloat Speed;"
  ],
  "documentation": "https://docs.unrealengine.com/5.0/en-US/unreal-engine-uproperty-specifier-reference/"
}
```

The best practices guide covers key Unreal Engine concepts:
- UPROPERTY: Property reflection and exposure
- UFUNCTION: Function reflection and Blueprint integration
- Components: Component creation and management
- Events: Event handling and delegation
- Replication: Network replication setup
- Blueprints: Blueprint/C++ interaction patterns

#### 6. API Documentation Query
```typescript
// Search the API documentation
{
  "name": "query_api",
  "arguments": {
    "query": "Actor",
    "category": "Object",
    "module": "Core",
    "includeExamples": true,
    "maxResults": 10
  }
}
```
Example output:
```json
{
  "results": [
    {
      "class": "AActor",
      "description": "Base class for all actors in the game",
      "module": "Core",
      "category": "Object",
      "syntax": "class AActor : public UObject",
      "examples": [
        "// Create a new actor\nAActor* MyActor = GetWorld()->SpawnActor<AActor>();"
      ],
      "remarks": [
        "Actors are the base building blocks of the game",
        "Can be placed in levels or spawned dynamically"
      ],
      "documentation": "https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Core/AActor",
      "relevance": 100
    }
  ]
}
```

The API documentation query tool provides:
- Full-text search across class documentation
- Filtering by category and module
- Code examples and usage patterns
- Relevance-based sorting of results
- Links to official documentation

#### 7. Subsystem Analysis
```typescript
// Analyze the Physics subsystem
{
  "name": "analyze_subsystem",
  "arguments": {
    "subsystem": "Physics"
  }
}
```
Example output:
```json
{
  "name": "Physics",
  "coreClasses": [
    "UPhysicsEngine",
    "FPhysScene",
    "UBodySetup"
  ],
  "keyFeatures": [
    "PhysX integration",
    "Collision detection",
    "Physical materials"
  ],
  "commonUseCases": [
    "Character movement",
    "Vehicle simulation",
    "Destructible environments"
  ]
}
```

### API Documentation

The analyzer now includes comprehensive API documentation capabilities:

1. **Automatic Documentation Generation**
   - Extracts documentation from source code comments
   - Analyzes class structure and relationships
   - Categorizes classes by type and module
   - Generates syntax examples and usage patterns

2. **Smart Search**
   - Full-text search across all documentation
   - Relevance-based ranking of results
   - Category and module filtering
   - Code example inclusion

3. **Documentation Categories**
   - Object: Base object classes (UObject derivatives)
   - Actor: Actor classes (AActor derivatives)
   - Structure: Data structures and types
   - Component: Component classes
   - Miscellaneous: Other classes and utilities

4. **Module Organization**
   - Core: Core engine functionality
   - RenderCore: Rendering system
   - PhysicsCore: Physics engine
   - And other engine modules

5. **Integration with Existing Tools**
   - Links with class analysis for detailed information
   - Connects to pattern detection for best practices
   - References official Unreal Engine documentation
   - Provides learning resources and examples

### Best Practices

1. Always set either the Unreal Engine path or custom codebase path before using analysis tools
2. Use specific class names when analyzing (e.g., "MyClass" instead of just "Class")
3. Leverage the file pattern parameter in `search_code` to narrow down results
4. Include implemented interfaces when analyzing class hierarchies for complete understanding
5. Use the subsystem analysis tool to get a high-level overview before diving into specific classes (Unreal Engine only)

### Error Handling

The analyzer will throw clear error messages when:
- No codebase path is set (Unreal Engine or custom)
- Provided path does not exist or is inaccessible
- Class or symbol cannot be found in the codebase
- Invalid file patterns are provided
- Syntax errors in search queries or C++ code
- Access to source files is restricted
- Tree-sitter parsing fails for C++ files

### Performance Considerations

- Large codebases may take longer to analyze
- Complex class hierarchies might require more processing time
- Broad search patterns could result in many matches
- Consider using more specific queries for faster results

## Testing

The project includes comprehensive test coverage for all major components:

### Test Coverage

- **Analyzer Tests**: Core functionality tests for the UnrealCodeAnalyzer class
  - Initialization and path validation
  - Class analysis and parsing
  - Reference finding
  - Code searching
  - Subsystem analysis
  - Cache management

- **Game Genres Tests**: Validation of the game genres knowledge base
  - Data structure verification
  - Genre-specific feature validation
  - Component naming conventions
  - Data completeness checks

- **MCP Server Tests**: Testing of the MCP server implementation
  - Server initialization
  - Tool registration and handling
  - Request/response validation
  - Error handling
  - Tool-specific functionality tests

### Running Tests

Run all tests:
```bash
npm test
```

Run tests in watch mode (useful during development):
```bash
npm run test:watch
```

### Writing Tests

When contributing new features, please ensure:
1. All new functionality has corresponding test coverage
2. Tests are organized in the `src/__tests__` directory
3. Mock external dependencies appropriately
4. Follow the existing test patterns for consistency

## Contributing

Contributions are welcome! Please feel free to submit pull requests with improvements to:

- Source code parsing capabilities
- New analysis features
- Performance optimizations
- Documentation improvements
- Test coverage

Before submitting a PR:
1. Ensure all tests pass (`npm test`)
2. Add tests for new functionality
3. Update documentation as needed
