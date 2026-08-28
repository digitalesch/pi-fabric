import { describe, expect, it } from 'vitest';

import type { Task } from '../../src/core/task.js';
import type { Result } from '../../src/core/result.js';

import { ExecutionState } from '../../src/runtime/execution-state.js';

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

describe('ExecutionState', () => {
  it('initializes tasks as pending', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1'), createTask('task-2')]);

    expect(state.all()).toEqual([
      {
        taskId: 'task-1',
        status: 'pending',
      },
      {
        taskId: 'task-2',
        status: 'pending',
      },
    ]);
  });

  it('starts a pending task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);

    state.start('task-1');

    const execution = state.get('task-1');

    expect(execution.status).toBe('running');
    expect(execution.startedAt).toBeDefined();
  });

  it('completes a running task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');

    const result = successResult('task-1');

    state.complete('task-1', result);

    const execution = state.get('task-1');

    expect(execution.status).toBe('completed');
    expect(execution.result).toBe(result);
    expect(execution.completedAt).toBeDefined();
  });

  it('fails a running task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');

    const result = failureResult('task-1');

    state.fail('task-1', result);

    const execution = state.get('task-1');

    expect(execution.status).toBe('failed');
    expect(execution.result).toBe(result);
    expect(execution.completedAt).toBeDefined();
  });

  it('blocks a pending task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);

    state.block('task-1');

    expect(state.get('task-1').status).toBe('blocked');
  });

  it('records task duration when a task completes', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');

    state.complete('task-1', successResult('task-1'));

    const execution = state.get('task-1');

    expect(execution.durationMs).toBeDefined();
    expect(execution.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records task duration when a task fails', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');

    state.fail('task-1', failureResult('task-1'));

    const execution = state.get('task-1');

    expect(execution.durationMs).toBeDefined();
    expect(execution.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records execution duration for completed tasks', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');

    state.complete('task-1', successResult('task-1'));

    const execution = state.get('task-1');

    expect(execution.startedAt).toBeDefined();
    expect(execution.completedAt).toBeDefined();
    expect(execution.durationMs).toBeDefined();

    expect(execution.durationMs).toBe(
      execution.completedAt! - execution.startedAt!,
    );
  });

  it('records execution duration for failed tasks', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);
    state.start('task-1');

    state.fail('task-1', failureResult('task-1'));

    const execution = state.get('task-1');

    expect(execution.durationMs).toBe(
      execution.completedAt! - execution.startedAt!,
    );
  });

  it('provides an execution snapshot', () => {
    const state = new ExecutionState();

    state.initialize([
      createTask('task-1'),
      createTask('task-2'),
      createTask('task-3'),
    ]);

    state.start('task-1');
    state.complete('task-1', successResult('task-1'));

    state.start('task-2');
    state.fail('task-2', failureResult('task-2'));

    state.block('task-3');

    expect(state.snapshot()).toMatchObject({
      total: 3,
      pending: 0,
      running: 0,
      completed: 1,
      failed: 1,
      blocked: 1,
      finished: true,
    });
  });

  it('reports unfinished execution while tasks are running', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1'), createTask('task-2')]);

    state.start('task-1');

    expect(state.snapshot()).toMatchObject({
      total: 2,
      pending: 1,
      running: 1,
      completed: 0,
      failed: 0,
      blocked: 0,
      finished: false,
    });
  });

  it('rejects invalid transitions', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);

    state.start('task-1');
    state.complete('task-1', successResult('task-1'));

    expect(() => state.start('task-1')).toThrow(
      'Invalid task execution transition',
    );
  });

  it('rejects completing a pending task', () => {
    const state = new ExecutionState();

    state.initialize([createTask('task-1')]);

    expect(() => state.complete('task-1', successResult('task-1'))).toThrow(
      'Invalid task execution transition',
    );
  });

  it('rejects unknown tasks', () => {
    const state = new ExecutionState();

    expect(() => state.start('missing')).toThrow(
      'Task execution not found: missing',
    );
  });

  it('rejects duplicate initialization', () => {
    const state = new ExecutionState();

    expect(() =>
      state.initialize([createTask('task-1'), createTask('task-1')]),
    ).toThrow('Duplicate task ID: task-1');
  });
});
