import type { TaskExecution } from './task-execution.js';

export interface ExecutionSnapshot {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  blocked: number;
  finished: boolean;
  executions: TaskExecution[];
}
