import { describe, expect, it } from 'vitest';

import { ExecutionHistory } from '../../src/runtime/execution-history.js';
import { ExecutionState } from '../../src/runtime/execution-state.js';
import { createTask } from '../helpers/create-task.js';
import { Result } from '../../src/core/result.js';

const successResult = (taskId: string): Result => ({
  taskId,
  success: true,
  output: {},
  metadata: {
    nodeId: 'node',
  },
});

const failureResult = (taskId: string): Result => ({
  taskId,
  success: false,
  output: null,
  metadata: {
    nodeId: 'node',
  },
  error: {
    code: 'TEST_FAILURE',
    message: 'Task failed',
  },
});

describe('ExecutionHistory', () => {
  it('returns the latest event for a task', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
    });

    expect(history.latest('task-1')?.type).toBe('task_completed');
  });

  it('returns undefined when a task has no events', () => {
    const history = new ExecutionHistory();

    expect(history.latest('missing')).toBeUndefined();
  });

  it('does not expose internal event objects', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    const events = history.all();

    events[0].taskId = 'modified';

    expect(history.all()[0].taskId).toBe('task-1');
  });

  it('rejects starting a blocked task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.block('task-1');

    expect(() => state.start('task-1')).toThrow(
      'Invalid task execution transition: blocked -> running',
    );
  });

  it('rejects completing a blocked task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.block('task-1');

    expect(() => state.complete('task-1', successResult('task-1'))).toThrow(
      'Invalid task execution transition: blocked -> completed',
    );
  });

  it('rejects failing a blocked task', () => {
    const state = new ExecutionState();

    const failureResult = (taskId: string): Result => ({
      taskId,
      success: false,
      output: null,
      metadata: {
        nodeId: 'node',
      },
      error: {
        code: 'TEST_FAILURE',
        message: 'Task failed',
      },
    });

    state.initialize([createTask('task-1')]);
    state.block('task-1');

    expect(() => state.fail('task-1', failureResult('task-1'))).toThrow(
      'Invalid task execution transition: blocked -> failed',
    );
  });

  it('rejects completing a completed task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');
    state.complete('task-1', successResult('task-1'));

    expect(() => state.complete('task-1', successResult('task-1'))).toThrow(
      'Invalid task execution transition: completed -> completed',
    );
  });

  it('rejects failing a completed task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');
    state.complete('task-1', successResult('task-1'));

    expect(() => state.fail('task-1', failureResult('task-1'))).toThrow(
      'Invalid task execution transition: completed -> failed',
    );
  });

  it('rejects completing a failed task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');
    state.fail('task-1', failureResult('task-1'));

    expect(() => state.complete('task-1', successResult('task-1'))).toThrow(
      'Invalid task execution transition: failed -> completed',
    );
  });

  it('rejects restarting a failed task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');
    state.fail('task-1', failureResult('task-1'));

    expect(() => state.start('task-1')).toThrow(
      'Invalid task execution transition: failed -> running',
    );
  });

  it('returns events for a specific task', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    history.record({
      type: 'task_started',
      taskId: 'task-2',
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
    });

    expect(history.forTask('task-1').map((event) => event.type)).toEqual([
      'task_started',
      'task_completed',
    ]);
  });

  it('returns events by type', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
    });

    history.record({
      type: 'task_started',
      taskId: 'task-2',
    });

    expect(history.byType('task_started').map((event) => event.taskId)).toEqual(
      ['task-1', 'task-2'],
    );
  });

  it('returns the latest event for a task', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
    });

    expect(history.latest('task-1')).toMatchObject({
      type: 'task_completed',
      taskId: 'task-1',
    });
  });

  it('returns undefined when a task has no history', () => {
    const history = new ExecutionHistory();

    expect(history.latest('missing-task')).toBeUndefined();
  });

  it('does not expose mutable internal events', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    const events = history.forTask('task-1');

    events.pop();

    expect(history.forTask('task-1')).toHaveLength(1);
  });

  it('records execution events', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
    });

    const events = history.all();

    expect(events).toHaveLength(1);

    expect(events[0]).toMatchObject({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
    });

    expect(events[0].timestamp).toEqual(expect.any(Number));
  });

  it('preserves event order', () => {
    const history = new ExecutionHistory();

    history.record({
      type: 'task_started',
      taskId: 'task-1',
    });

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
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
    });

    history.clear();

    expect(history.all()).toEqual([]);
  });
});
