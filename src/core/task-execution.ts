import type { Result } from './result.js';

export type TaskExecutionStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export interface TaskExecution {
  taskId: string;
  status: TaskExecutionStatus;

  startedAt?: number;
  completedAt?: number;
  durationMs?: number;

  result?: Result;
}
