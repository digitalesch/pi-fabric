import type { ExecutionSnapshot } from '../core/execution-snapshot.js';

import { TaskGraph } from './task-graph.js';

export interface CriticalPath {
  taskIds: string[];
  durationMs: number;
}

export function calculateCriticalPath(
  graph: TaskGraph,
  snapshot: ExecutionSnapshot,
): CriticalPath {
  const executions = new Map(
    snapshot.executions.map((execution) => [execution.taskId, execution]),
  );

  const memo = new Map<string, CriticalPath>();
  const visiting = new Set<string>();

  const calculateFrom = (taskId: string): CriticalPath => {
    const cached = memo.get(taskId);

    if (cached) {
      return cached;
    }

    if (visiting.has(taskId)) {
      throw new Error(
        `Cycle detected while calculating critical path: ${taskId}`,
      );
    }

    const execution = executions.get(taskId);

    if (!execution) {
      throw new Error(`Execution not found for task: ${taskId}`);
    }

    if (
      execution.status === 'blocked' ||
      execution.status === 'pending' ||
      execution.status === 'running'
    ) {
      return {
        taskIds: [],
        durationMs: 0,
      };
    }

    if (execution.durationMs === undefined) {
      throw new Error(`Task has no execution duration: ${taskId}`);
    }

    visiting.add(taskId);

    const dependencies = graph.dependencies(taskId);

    let bestDependency: CriticalPath = {
      taskIds: [],
      durationMs: 0,
    };

    for (const dependencyId of dependencies) {
      const candidate = calculateFrom(dependencyId);

      if (candidate.taskIds.length === 0) {
        continue;
      }

      if (
        bestDependency.taskIds.length === 0 ||
        candidate.durationMs > bestDependency.durationMs
      ) {
        bestDependency = candidate;
      }
    }

    visiting.delete(taskId);

    const result: CriticalPath = {
      taskIds: [...bestDependency.taskIds, taskId],
      durationMs: bestDependency.durationMs + execution.durationMs,
    };

    memo.set(taskId, result);

    return result;
  };

  let criticalPath: CriticalPath = {
    taskIds: [],
    durationMs: 0,
  };

  for (const execution of snapshot.executions) {
    if (
      execution.status === 'blocked' ||
      execution.status === 'pending' ||
      execution.status === 'running'
    ) {
      continue;
    }

    const candidate = calculateFrom(execution.taskId);

    if (
      criticalPath.taskIds.length === 0 ||
      candidate.durationMs > criticalPath.durationMs ||
      (candidate.durationMs === criticalPath.durationMs &&
        candidate.taskIds.length > criticalPath.taskIds.length)
    ) {
      criticalPath = candidate;
    }
  }

  return criticalPath;
}
