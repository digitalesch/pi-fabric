import type { ExecutionEvent } from '../core/execution-event.js';
import type { ExecutionSnapshot } from '../core/execution-snapshot.js';

import {
  calculateExecutionMetrics,
  type ExecutionMetrics,
} from './execution-metrics.js';
import { calculateCriticalPath, type CriticalPath } from './critical-path.js';
import { ExecutionHistory } from './execution-history.js';
import { ExecutionState } from './execution-state.js';
import { ExecutionTimeline, type TimelineEntry } from './execution-timeline.js';
import { TaskGraph } from './task-graph.js';

export interface ExecutionDiagnostics {
  snapshot: ExecutionSnapshot;
  metrics: ExecutionMetrics;
  timeline: TimelineEntry[];
  criticalPath: CriticalPath;

  failedTaskIds: string[];
  blockedTaskIds: string[];
  retriedTaskIds: string[];

  events: ExecutionEvent[];
}

export function inspectExecution(
  state: ExecutionState,
  history: ExecutionHistory,
  graph: TaskGraph,
): ExecutionDiagnostics {
  const snapshot = state.snapshot();

  const metrics = calculateExecutionMetrics(snapshot, history);

  const timeline = new ExecutionTimeline(history).all();

  const criticalPath = calculateCriticalPath(graph, snapshot);

  const failedTaskIds = snapshot.executions
    .filter((execution) => execution.status === 'failed')
    .map((execution) => execution.taskId);

  const blockedTaskIds = snapshot.executions
    .filter((execution) => execution.status === 'blocked')
    .map((execution) => execution.taskId);

  const retriedTaskIds = [
    ...new Set(history.byType('task_retrying').map((event) => event.taskId)),
  ];

  return {
    snapshot,
    metrics,
    timeline,
    criticalPath,
    failedTaskIds,
    blockedTaskIds,
    retriedTaskIds,
    events: history.all(),
  };
}
