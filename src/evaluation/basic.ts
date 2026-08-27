import type { Result } from '../core/result.js';
import type { Evaluation, Evaluator } from './evaluator.js';

export class BasicEvaluator implements Evaluator {
  async evaluate(result: Result): Promise<Evaluation> {
    if (!result.success) {
      return {
        taskId: result.taskId,
        accepted: false,
        issues: [result.error?.message ?? 'Task execution failed'],
      };
    }

    if (result.output === null || result.output === undefined) {
      return {
        taskId: result.taskId,
        accepted: false,
        issues: ['Task produced no output'],
      };
    }

    return {
      taskId: result.taskId,
      accepted: true,
      issues: [],
    };
  }
}
