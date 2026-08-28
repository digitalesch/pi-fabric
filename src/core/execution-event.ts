import type { Result } from './result.js';

export type ExecutionEventType =
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_blocked'
  | 'task_retrying';

export interface ExecutionEvent {
  type: ExecutionEventType;
  taskId: string;
  timestamp: number;
  nodeId?: string;
  attempt?: number;
  result?: Result;
}
