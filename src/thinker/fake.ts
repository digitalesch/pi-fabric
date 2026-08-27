import type { Objective } from '../core/objective.js';

import type { Plan } from '../core/plan.js';

import type { Result } from '../core/result.js';

import type { Evaluation } from '../evaluation/evaluator.js';

import type { Thinker } from './thinker.js';

import { EvaluationDecision } from '../core/evaluation-decision.js';

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
    _results: Result[],
    evaluations: Evaluation[],
  ): Promise<EvaluationDecision> {
    return {
      accepted: evaluations.every((evaluation) => evaluation.accepted),
      issues: evaluations.flatMap((evaluation) => evaluation.issues),
    };
  }

  async replan(
    _objective: Objective,
    previousPlan: Plan,
    _results: Result[],
    evaluations: Evaluation[],
  ): Promise<Plan> {
    const idMap = new Map(
      previousPlan.tasks.map((task) => [task.id, `replanned-${task.id}`]),
    );

    return {
      ...previousPlan,
      tasks: previousPlan.tasks.map((task, index) => {
        const evaluation = evaluations[index];

        return {
          ...task,
          id: idMap.get(task.id)!,
          dependencies: task.dependencies.map(
            (dependency) => idMap.get(dependency) ?? dependency,
          ),
          context: {
            ...task.context,
            facts: {
              ...task.context.facts,
              previousEvaluation: evaluation,
            },
            constraints: [
              ...task.context.constraints,
              ...(evaluation.feedback?.missing ?? []).map(
                (missing) => `Ensure the output includes: ${missing}`,
              ),
            ],
          },
        };
      }),
    };
  }

  async synthesize(_objective: Objective, results: Result[]): Promise<string> {
    return JSON.stringify(results, null, 2);
  }
}
