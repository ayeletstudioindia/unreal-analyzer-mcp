declare module 'tree-sitter' {
  export class Parser {
    setLanguage(language: any): void;
    parse(input: string): Tree;
    createQuery(source: string): Query;
  }

  export interface Tree {
    rootNode: SyntaxNode;
  }

  export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: Position;
    endPosition: Position;
    children: SyntaxNode[];
    parent: SyntaxNode | null;
    descendantsOfType(type: string): SyntaxNode[];
    hasError(): boolean;
  }

  export interface Position {
    row: number;
    column: number;
  }

  export interface Query {
    matches(node: SyntaxNode): QueryMatch[];
  }

  export interface QueryMatch {
    pattern: number;
    captures: QueryCapture[];
  }

  export interface QueryCapture {
    name: string;
    node: SyntaxNode;
  }
}

declare module 'tree-sitter-cpp' {
  const language: any;
  export = language;
}
