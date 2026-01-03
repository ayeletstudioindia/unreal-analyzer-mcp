// src/tree-sitter-compat.ts
import * as TS from "tree-sitter";
import * as CPPMod from "tree-sitter-cpp";

// CJS/ESM normalization helpers
const ParserCJS = (TS as any).default ?? (TS as any);
const CPPLanguage = (CPPMod as any).default ?? (CPPMod as any);

// Tree-sitter's Query constructor may or may not be exposed depending on typings/module shape.
// At runtime it's typically available as TS.Query.
const QueryCtor = (TS as any).Query;

export { ParserCJS, CPPLanguage, QueryCtor };

// Runtime types (these come from tree-sitter typings; we only use them as types)
export type Tree = import("tree-sitter").Tree;
export type SyntaxNode = import("tree-sitter").SyntaxNode;
export type Query = import("tree-sitter").Query;
export type QueryCapture = import("tree-sitter").QueryCapture;
