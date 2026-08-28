import type { ExecutionEvent } from '../core/execution-event.js';
import type { ExecutionSnapshot } from '../core/execution-snapshot.js';

import { ExecutionHistory } from './execution-history.js';
import {
  calculateExecutionMetrics,
  type ExecutionMetrics,
} from './execution-metrics.js';
import { ExecutionState } from './execution-state.js';
import { ExecutionTimeline, type TimelineEntry } from './execution-timeline.js';

export class ExecutionInspector {
  private readonly timelineView: ExecutionTimeline;

  constructor(
    private readonly state: ExecutionState,
    private readonly history: ExecutionHistory,
  ) {
    this.timelineView = new ExecutionTimeline(history);
  }

  snapshot(): ExecutionSnapshot {
    return this.state.snapshot();
  }

  metrics(): ExecutionMetrics {
    return calculateExecutionMetrics(this.state.snapshot(), this.history);
  }

  timeline(): TimelineEntry[] {
    return this.timelineView.all();
  }

  eventsFor(taskId: string): ExecutionEvent[] {
    return this.history.forTask(taskId);
  }

  latestEvent(taskId: string): ExecutionEvent | undefined {
    return this.history.latest(taskId);
  }
}
