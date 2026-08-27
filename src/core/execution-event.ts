import type { Result } from './result.js';

export type ExecutionEventType =
  'task_started' | 'task_completed' | 'task_failed' | 'task_blocked';

export interface ExecutionEvent {
  type: ExecutionEventType;
  taskId: string;
  timestamp: number;
  nodeId?: string;
  result?: Result;
}
