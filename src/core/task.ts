import type { Context } from './context.js';
import type { ExecutionRequirements } from './execution-requirements.js';

export interface Task {
  id: string;

  aspect: string;

  input: unknown;

  context: {
    facts: Record<string, unknown>;
    constraints: string[];
    assumptions: string[];
    references: string[];
  };

  outputSchema: unknown;

  dependencies: string[];

  requirements?: ExecutionRequirements;
}
