import type { Objective } from '../core/objective.js';
import type { Plan } from '../core/plan.js';
import type { Result } from '../core/result.js';
import type { Evaluation } from '../evaluation/evaluator.js';

export interface Thinker {
  plan(objective: Objective): Promise<Plan>;

  evaluate(
    objective: Objective,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<unknown>;

  synthesize(objective: Objective, results: Result[]): Promise<string>;

  replan(
    objective: Objective,
    previousPlan: Plan,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<Plan>;
}
