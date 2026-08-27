import type { Objective } from '../core/objective.js';
import type { Plan } from '../core/plan.js';
import type { Result } from '../core/result.js';
import type { Thinker } from './thinker.js';
import type { Evaluation } from '../evaluation/evaluator.js';

export class FakeThinker implements Thinker {
  async plan(objective: Objective): Promise<Plan> {
    return {
      tasks: [
        {
          id: 'extract-requirements',
          aspect: 'extract_requirements',
          input: {
            objective: objective.description,
          },
          context: {
            facts: {},
            constraints: [],
            assumptions: [],
            references: [],
          },
          outputSchema: {
            requirements: 'string[]',
          },
          dependencies: [],
        },
      ],
    };
  }

  async evaluate(
    _objective: Objective,
    results: Result[],
    _evaluations: Evaluation[],
  ): Promise<unknown> {
    return results;
  }

  async synthesize(_objective: Objective, results: Result[]): Promise<string> {
    return JSON.stringify(results, null, 2);
  }

  async replan(
    _objective: Objective,
    previousPlan: Plan,
    _results: Result[],
    _evaluations: Evaluation[],
  ): Promise<Plan> {
    return previousPlan;
  }
}
