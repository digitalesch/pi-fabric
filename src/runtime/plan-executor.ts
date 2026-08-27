import type { PhysicalPlan } from '../core/physical-plan.js';
import type { Result } from '../core/result.js';

import { Executor } from './executor.js';
import { TaskGraph } from './task-graph.js';

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
    const graph = new TaskGraph(
      plan.tasks.map((physicalTask) => physicalTask.task),
    );

    const physicalTasks = new Map(
      plan.tasks.map((physicalTask) => [physicalTask.task.id, physicalTask]),
    );

    const completed = new Set<string>();
    const results = new Map<string, Result>();

    while (completed.size < plan.tasks.length) {
      const ready = graph.ready(completed);

      if (ready.length === 0) {
        throw new Error(
          'Unable to resolve task dependencies. Possible cycle or missing dependency.',
        );
      }

      const batch = ready.slice(0, this.maxConcurrency);

      const batchResults = await Promise.all(
        batch.map(async (task) => {
          const physicalTask = physicalTasks.get(task.id);

          if (!physicalTask) {
            throw new Error(`Physical task not found: ${task.id}`);
          }

          const dependencyResults = graph
            .dependencies(task.id)
            .map((dependency) => {
              const result = results.get(dependency);

              if (!result) {
                throw new Error(`Dependency result not found: ${dependency}`);
              }

              return result;
            });

          const failedDependency = dependencyResults.find(
            (result) => !result.success,
          );

          if (failedDependency) {
            return {
              taskId: task.id,
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
            graph
              .dependencies(task.id)
              .map((dependency, index) => [
                dependency,
                dependencyResults[index],
              ]),
          );

          const taskWithDependencies = {
            ...task,
            context: {
              ...task.context,
              facts: {
                ...task.context.facts,
                dependencies: dependencyOutputs,
              },
            },
          };

          return this.executor.executeOn(
            taskWithDependencies,
            physicalTask.nodeId,
          );
        }),
      );

      for (let i = 0; i < batch.length; i++) {
        const task = batch[i];
        const result = batchResults[i];

        completed.add(task.id);
        results.set(task.id, result);
      }
    }

    return plan.tasks.map((physicalTask) => results.get(physicalTask.task.id)!);
  }
}
