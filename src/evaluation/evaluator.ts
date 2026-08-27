import type { Result } from '../core/result.js';

export interface Evaluation {
  taskId: string;

  accepted: boolean;

  issues: string[];

  feedback?: Record<string, unknown>;
}

export interface Evaluator {
  evaluate(result: Result): Promise<Evaluation>;
}
