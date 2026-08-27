import { describe, expect, it } from 'vitest';

import type { ExecutionEvent } from '../../src/core/execution-event.js';
import { ExecutionHistory } from '../../src/runtime/execution-history.js';

describe('ExecutionHistory', () => {
  it('records execution events', () => {
    const history = new ExecutionHistory();

    const event: ExecutionEvent = {
      type: 'task_started',
      taskId: 'task-1',
      timestamp: 123,
      nodeId: 'node-1',
    };

    history.record(event);

    expect(history.all()).toEqual([event]);
  });

  it('preserves event order', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      timestamp: 1,
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
      timestamp: 2,
    });

    expect(history.all().map((event) => event.type)).toEqual([
      'task_started',
      'task_completed',
    ]);
  });

  it('returns a copy of the event history', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      timestamp: 1,
    });

    const events = history.all();

    events.pop();

    expect(history.all()).toHaveLength(1);
  });

  it('clears the event history', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      timestamp: 1,
    });

    history.clear();

    expect(history.all()).toEqual([]);
  });
});
