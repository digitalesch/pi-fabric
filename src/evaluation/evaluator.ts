import type { Result } from '../core/result.js';

export interface Evaluation {
  taskId: string;

  accepted: boolean;

  issues: string[];

  feedback?: {
    missing?: string[];

    suggestions?: string[];

    confidence?: number;
  };
}

export interface Evaluator {
  evaluate(result: Result): Promise<Evaluation>;
}
