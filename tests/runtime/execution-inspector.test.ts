import { describe, expect, it } from 'vitest';

import { ExecutionHistory } from '../../src/runtime/execution-history.js';
import { ExecutionInspector } from '../../src/runtime/execution-inspector.js';
import { ExecutionState } from '../../src/runtime/execution-state.js';

import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';

const createTask = (id: string): Task => ({
  id,
  aspect: 'extract_requirements',
  input: {},
  context: {
    facts: {},
    constraints: [],
    assumptions: [],
    references: [],
  },
  outputSchema: {},
  dependencies: [],
});

const successResult = (taskId: string): Result => ({
  taskId,
  success: true,
  output: {},
  metadata: {
    nodeId: 'node-1',
  },
});

describe('ExecutionInspector', () => {
  it('provides the current execution snapshot', () => {
    const state = new ExecutionState();
    const history = new ExecutionHistory();

    state.initialize([createTask('task-1'), createTask('task-2')]);

    state.start('task-1');

    const inspector = new ExecutionInspector(state, history);

    expect(inspector.snapshot()).toMatchObject({
      total: 2,
      running: 1,
      pending: 1,
    });
  });

  it('provides execution metrics', () => {
    const state = new ExecutionState();
    const history = new ExecutionHistory();

    state.initialize([createTask('task-1')]);

    state.start('task-1');

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 1,
    });

    state.complete('task-1', successResult('task-1'));

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 1,
    });

    const inspector = new ExecutionInspector(state, history);

    expect(inspector.metrics()).toMatchObject({
      totalTasks: 1,
      completedTasks: 1,
      failedTasks: 0,
      blockedTasks: 0,
      retryCount: 0,
      successRate: 1,
    });
  });

  it('provides the execution timeline', () => {
    const state = new ExecutionState();
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 1,
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 1,
    });

    const inspector = new ExecutionInspector(state, history);

    expect(inspector.timeline().map((event) => event.type)).toEqual([
      'task_started',
      'task_completed',
    ]);
  });

  it('provides events for a task', () => {
    const state = new ExecutionState();
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
      nodeId: 'node-1',
    });

    const inspector = new ExecutionInspector(state, history);

    expect(inspector.eventsFor('task-1')).toHaveLength(2);
  });

  it('provides the latest event for a task', () => {
    const state = new ExecutionState();
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
    });

    const inspector = new ExecutionInspector(state, history);

    expect(inspector.latestEvent('task-1')).toMatchObject({
      type: 'task_completed',
      taskId: 'task-1',
    });
  });

  it('returns undefined for a task without events', () => {
    const inspector = new ExecutionInspector(
      new ExecutionState(),
      new ExecutionHistory(),
    );

    expect(inspector.latestEvent('missing')).toBeUndefined();
  });
});
