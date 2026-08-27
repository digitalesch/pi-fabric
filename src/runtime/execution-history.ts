import type { ExecutionEvent } from '../core/execution-event.js';

export class ExecutionHistory {
  private readonly events: ExecutionEvent[] = [];

  record(event: ExecutionEvent): void {
    this.events.push(event);
  }

  all(): ExecutionEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}
