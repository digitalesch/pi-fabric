import type { Result } from '../core/result.js';
import type { Evaluation } from '../core/evaluation.js';

export type { Evaluation } from '../core/evaluation.js';

export interface Evaluator {
  evaluate(result: Result): Promise<Evaluation>;
}
