import type {
  ExecutionEvent,
  ExecutionEventType,
} from '../core/execution-event.js';

import type { ExecutionHistory } from './execution-history.js';

export interface TimelineEntry {
  type: ExecutionEventType;
  taskId: string;
  timestamp: number;
  nodeId?: string;
  attempt?: number;
}

export class ExecutionTimeline {
  constructor(private readonly history: ExecutionHistory) {}

  all(): TimelineEntry[] {
    return this.history.all().map((event) => this.toEntry(event));
  }

  forTask(taskId: string): TimelineEntry[] {
    return this.history.forTask(taskId).map((event) => this.toEntry(event));
  }

  since(timestamp: number): TimelineEntry[] {
    return this.all().filter((event) => event.timestamp >= timestamp);
  }

  private toEntry(event: ExecutionEvent): TimelineEntry {
    return {
      type: event.type,
      taskId: event.taskId,
      timestamp: event.timestamp,
      ...(event.nodeId !== undefined && {
        nodeId: event.nodeId,
      }),
      ...(event.attempt !== undefined && {
        attempt: event.attempt,
      }),
    };
  }
}
