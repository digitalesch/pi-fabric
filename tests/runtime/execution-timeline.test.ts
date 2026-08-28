import { describe, expect, it } from 'vitest';

import { ExecutionHistory } from '../../src/runtime/execution-history.js';
import { ExecutionTimeline } from '../../src/runtime/execution-timeline.js';

describe('ExecutionTimeline', () => {
  it('returns events in execution order', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 1,
    });

    history.record({
      type: 'task_retrying',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 2,
    });

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 2,
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 2,
    });

    const timeline = new ExecutionTimeline(history);

    expect(timeline.all().map((entry) => entry.type)).toEqual([
      'task_started',
      'task_retrying',
      'task_started',
      'task_completed',
    ]);
  });

  it('filters timeline entries by task', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 1,
    });

    history.record({
      type: 'task_started',
      taskId: 'task-2',
      nodeId: 'node-2',
      attempt: 1,
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 1,
    });

    const timeline = new ExecutionTimeline(history);

    expect(timeline.forTask('task-1')).toMatchObject([
      {
        type: 'task_started',
        taskId: 'task-1',
        nodeId: 'node-1',
        attempt: 1,
      },
      {
        type: 'task_completed',
        taskId: 'task-1',
        nodeId: 'node-1',
        attempt: 1,
      },
    ]);
  });

  it('filters entries since a timestamp', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    const timeline = new ExecutionTimeline(history);

    const timestamp = timeline.all()[0].timestamp;

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
    });

    expect(timeline.since(timestamp)).toHaveLength(2);
  });

  it('returns a snapshot of the timeline', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    const timeline = new ExecutionTimeline(history);

    const entries = timeline.all();

    entries.pop();

    expect(timeline.all()).toHaveLength(1);
  });

  it('preserves optional execution metadata', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_retrying',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 2,
    });

    const timeline = new ExecutionTimeline(history);

    expect(timeline.all()[0]).toMatchObject({
      type: 'task_retrying',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 2,
    });
  });
});
