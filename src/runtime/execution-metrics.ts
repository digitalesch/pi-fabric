import type { ExecutionSnapshot } from '../core/execution-snapshot.js';
import type { ExecutionHistory } from './execution-history.js';

export interface ExecutionMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  blockedTasks: number;

  successRate: number;

  totalDurationMs: number;
  averageDurationMs: number;

  retryCount: number;
}

export function calculateExecutionMetrics(
  snapshot: ExecutionSnapshot,
  history: ExecutionHistory,
): ExecutionMetrics {
  const finishedTasks = snapshot.completed + snapshot.failed;

  const successRate =
    finishedTasks === 0 ? 0 : snapshot.completed / finishedTasks;

  const durations = snapshot.executions
    .map((execution) => execution.durationMs)
    .filter((duration): duration is number => duration !== undefined);

  const totalDurationMs = durations.reduce(
    (total, duration) => total + duration,
    0,
  );

  const averageDurationMs =
    durations.length === 0 ? 0 : totalDurationMs / durations.length;

  const retryCount = history.byType('task_retrying').length;

  return {
    totalTasks: snapshot.total,
    completedTasks: snapshot.completed,
    failedTasks: snapshot.failed,
    blockedTasks: snapshot.blocked,
    successRate,
    totalDurationMs,
    averageDurationMs,
    retryCount: Math.max(0, retryCount),
  };
}
