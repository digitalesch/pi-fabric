import type { Objective } from '../core/objective.js';
import type { Plan } from '../core/plan.js';
import type { Result } from '../core/result.js';
import type { Evaluation } from '../evaluation/evaluator.js';
import type { EvaluationDecision } from '../core/evaluation-decision.js';

export interface Thinker {
  plan(objective: Objective): Promise<Plan>;

  evaluate(
    objective: Objective,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<EvaluationDecision>;

  replan(
    objective: Objective,
    previousPlan: Plan,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<Plan>;

  synthesize(objective: Objective, results: Result[]): Promise<string>;
}
