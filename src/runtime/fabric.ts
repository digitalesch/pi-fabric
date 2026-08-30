import type { Objective } from '../core/objective.js';
import type { Thinker } from '../thinker/thinker.js';
import { AspectRegistry } from './aspect-registry.js';
import { PlanExecutor } from './plan-executor.js';
import { Planner } from './planner.js';
import { PlanValidator } from './plan-validator.js';
import { Evaluator } from '../evaluation/evaluator.js';
import type { InferenceProvider } from '../inference/provider.js';
import { PerformanceRegistry } from './performance-registry.js';

export class Fabric {
  constructor(
    private readonly thinker: Thinker,
    private readonly planner: Planner,
    private readonly planExecutor: PlanExecutor,
    private readonly aspectRegistry: AspectRegistry,
    private readonly planValidator: PlanValidator,
    private readonly evaluator: Evaluator,
    private readonly maxAttempts = 3,
    private readonly providers: InferenceProvider[] = [],
    private readonly performanceRegistry: PerformanceRegistry,
  ) {
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error('maxAttempts must be a positive integer');
    }
  }

  getPerformanceRegistry(): PerformanceRegistry {
    return this.performanceRegistry;
  }

  async run(objective: Objective): Promise<string> {
    let plan = await this.thinker.plan(objective);

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      for (const task of plan.tasks) {
        this.aspectRegistry.get(task.aspect);
      }

      const physicalPlan = this.planner.plan(plan);

      this.planValidator.validate(physicalPlan);

      const results = await this.planExecutor.execute(physicalPlan);

      const evaluations = await Promise.all(
        results.map((result) => this.evaluator.evaluate(result)),
      );

      const decision = await this.thinker.evaluate(
        objective,
        results,
        evaluations,
      );

      if (decision.accepted) {
        return this.thinker.synthesize(objective, results);
      }

      if (attempt === this.maxAttempts) {
        throw new Error(
          `Maximum execution attempts exceeded: ${this.maxAttempts}`,
        );
      }

      plan = await this.thinker.replan(objective, plan, results, evaluations);
    }

    throw new Error('Unreachable');
  }

  async close(): Promise<void> {
    await Promise.all(this.providers.map((provider) => provider.close?.()));
  }
}
