import type { PhysicalPlan } from '../core/physical-plan.js';
import type { Result } from '../core/result.js';
import { Executor } from './executor.js';

export class PlanExecutor {
  constructor(
    private readonly executor: Executor,
    private readonly maxConcurrency = Infinity,
  ) {
    if (
      maxConcurrency !== Infinity &&
      (!Number.isInteger(maxConcurrency) || maxConcurrency <= 0)
    ) {
      throw new Error('maxConcurrency must be a positive integer');
    }
  }

  async execute(plan: PhysicalPlan): Promise<Result[]> {
    const completed = new Map<string, Result>();

    const pending = [...plan.tasks];

    while (pending.length > 0) {
      const runnable = pending.filter((physicalTask) =>
        physicalTask.task.dependencies.every((dependency) =>
          completed.has(dependency),
        ),
      );

      if (runnable.length === 0) {
        throw new Error(
          'Unable to resolve task dependencies. Possible cycle or missing dependency.',
        );
      }

      const batch = runnable.slice(0, this.maxConcurrency);

      const batchResults = await Promise.all(
        batch.map(async (physicalTask) => {
          const dependencyResults = physicalTask.task.dependencies.map(
            (dependency) => completed.get(dependency)!,
          );

          const failedDependency = dependencyResults.find(
            (result) => !result.success,
          );

          if (failedDependency) {
            return {
              taskId: physicalTask.task.id,
              success: false,
              output: null,
              metadata: {
                nodeId: physicalTask.nodeId,
              },
              error: {
                code: 'DEPENDENCY_FAILED',
                message: 'A dependency failed',
              },
            };
          }

          const dependencyOutputs = Object.fromEntries(
            physicalTask.task.dependencies.map((dependency, index) => [
              dependency,
              dependencyResults[index],
            ]),
          );

          const task = {
            ...physicalTask.task,
            context: {
              ...physicalTask.task.context,
              facts: {
                ...physicalTask.task.context.facts,
                dependencies: dependencyOutputs,
              },
            },
          };

          return this.executor.executeOn(task, physicalTask.nodeId);
        }),
      );

      for (let i = 0; i < batch.length; i++) {
        completed.set(batch[i].task.id, batchResults[i]);

        const index = pending.indexOf(batch[i]);

        pending.splice(index, 1);
      }
    }

    return [...completed.values()];
  }
}
