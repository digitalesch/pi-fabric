import type {
  ExecutionEvent,
  ExecutionEventType,
} from '../core/execution-event.js';

export class ExecutionHistory {
  private readonly events: ExecutionEvent[] = [];

  record(event: Omit<ExecutionEvent, 'timestamp'>): void {
    this.events.push({
      ...event,
      timestamp: Date.now(),
    });
  }

  all(): ExecutionEvent[] {
    return this.events.map((event) => ({ ...event }));
  }

  forTask(taskId: string): ExecutionEvent[] {
    return this.events
      .filter((event) => event.taskId === taskId)
      .map((event) => ({ ...event }));
  }

  byType(type: ExecutionEventType): ExecutionEvent[] {
    return this.events
      .filter((event) => event.type === type)
      .map((event) => ({ ...event }));
  }

  latest(taskId: string): ExecutionEvent | undefined {
    const events = this.forTask(taskId);

    return events.at(-1);
  }

  clear(): void {
    this.events.length = 0;
  }
}
