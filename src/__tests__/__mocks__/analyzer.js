import { jest } from '@jest/globals';

export class UnrealCodeAnalyzer {
  initialize = jest.fn();
  initializeCustomCodebase = jest.fn();
  isInitialized = jest.fn().mockReturnValue(true);
  analyzeClass = jest.fn();
  findClassHierarchy = jest.fn();
  findReferences = jest.fn();
  searchCode = jest.fn();
  analyzeSubsystem = jest.fn();
}
