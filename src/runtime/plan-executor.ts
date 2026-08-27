import type { PhysicalPlan } from '../core/physical-plan.js';
import type { Result } from '../core/result.js';

import { Executor } from './executor.js';
import { ExecutionState } from './execution-state.js';
import { TaskGraph } from './task-graph.js';
import { ExecutionHistory } from './execution-history.js';

export class PlanExecutor {
  public readonly executionState: ExecutionState;

  constructor(
    private readonly executor: Executor,
    private readonly history = new ExecutionHistory(),
    private readonly maxConcurrency = Infinity,
  ) {
    if (
      maxConcurrency !== Infinity &&
      (!Number.isInteger(maxConcurrency) || maxConcurrency <= 0)
    ) {
      throw new Error('maxConcurrency must be a positive integer');
    }

    this.executionState = new ExecutionState();
  }

  getHistory(): ExecutionHistory {
    return this.history;
  }

  async execute(plan: PhysicalPlan): Promise<Result[]> {
    const graph = new TaskGraph(
      plan.tasks.map((physicalTask) => physicalTask.task),
    );

    this.executionState.initialize(
      plan.tasks.map((physicalTask) => physicalTask.task),
    );

    const physicalTasks = new Map(
      plan.tasks.map((physicalTask) => [physicalTask.task.id, physicalTask]),
    );

    const completed = new Map<string, Result>();

    while (completed.size < plan.tasks.length) {
      const completedIds = new Set(completed.keys());

      const ready = graph.ready(completedIds);

      if (ready.length === 0) {
        throw new Error(
          'Unable to resolve task dependencies. Possible cycle or missing dependency.',
        );
      }

      const runnable = ready.map((task) => physicalTasks.get(task.id)!);

      const batch = runnable.slice(0, this.maxConcurrency);

      const batchResults = await Promise.all(
        batch.map(async (physicalTask) => {
          const dependencies = physicalTask.task.dependencies.map(
            (dependency) => completed.get(dependency)!,
          );

          const failedDependency = dependencies.find(
            (result) => !result.success,
          );

          if (failedDependency) {
            this.executionState.block(physicalTask.task.id);

            this.history.record({
              type: 'task_blocked',
              taskId: physicalTask.task.id,
              nodeId: physicalTask.nodeId,
            });

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
              dependencies[index],
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

          this.executionState.start(task.id);

          this.history.record({
            type: 'task_started',
            taskId: task.id,
            nodeId: physicalTask.nodeId,
          });

          const result = await this.executor.executeOn(
            task,
            physicalTask.nodeId,
          );

          if (result.success) {
            this.executionState.complete(task.id, result);

            this.history.record({
              type: 'task_completed',
              taskId: task.id,
              nodeId: physicalTask.nodeId,
              result,
            });
          } else {
            this.executionState.fail(task.id, result);

            this.history.record({
              type: 'task_failed',
              taskId: task.id,
              nodeId: physicalTask.nodeId,
              result,
            });
          }

          return result;
        }),
      );

      for (let i = 0; i < batch.length; i++) {
        completed.set(batch[i].task.id, batchResults[i]);
      }
    }

    return [...completed.values()];
  }
}
