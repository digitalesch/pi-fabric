import { describe, expect, it } from 'vitest';

import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';

import { ExecutionHistory } from '../../src/runtime/execution-history.js';
import {
  inspectExecution,
  type ExecutionDiagnostics,
} from '../../src/runtime/execution-diagnostics.js';
import { ExecutionState } from '../../src/runtime/execution-state.js';
import { TaskGraph } from '../../src/runtime/task-graph.js';

const createTask = (id: string, dependencies: string[] = []): Task => ({
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
  dependencies,
});

const successResult = (taskId: string): Result => ({
  taskId,
  success: true,
  output: {},
  metadata: {
    nodeId: 'node-1',
  },
});

const failureResult = (taskId: string): Result => ({
  taskId,
  success: false,
  output: null,
  metadata: {
    nodeId: 'node-1',
  },
  error: {
    code: 'TEST_FAILURE',
    message: 'Task failed',
  },
});

const createRuntime = (tasks: Task[]) => {
  const state = new ExecutionState();
  const history = new ExecutionHistory();
  const graph = new TaskGraph(tasks);

  state.initialize(tasks);

  return {
    state,
    history,
    graph,
  };
};

describe('inspectExecution', () => {
  it('returns execution snapshot', () => {
    const { state, history, graph } = createRuntime([createTask('task-1')]);

    state.start('task-1');
    state.complete('task-1', successResult('task-1'));

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics.snapshot).toMatchObject({
      total: 1,
      pending: 0,
      running: 0,
      completed: 1,
      failed: 0,
      blocked: 0,
      finished: true,
    });
  });

  it('returns execution metrics', () => {
    const { state, history, graph } = createRuntime([createTask('task-1')]);

    state.start('task-1');
    state.complete('task-1', successResult('task-1'));

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics.metrics).toMatchObject({
      totalTasks: 1,
      completedTasks: 1,
      failedTasks: 0,
      blockedTasks: 0,
      successRate: 1,
    });
  });

  it('returns execution timeline', () => {
    const { state, history, graph } = createRuntime([createTask('task-1')]);

    history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
    });

    state.start('task-1');

    state.complete('task-1', successResult('task-1'));

    history.record({
      type: 'task_completed',
      taskId: 'task-1',
      nodeId: 'node-1',
    });

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics.timeline).toHaveLength(2);
    expect(diagnostics.timeline.map((entry) => entry.taskId)).toEqual([
      'task-1',
      'task-1',
    ]);
  });

  it('returns the critical path', () => {
    const tasks = [
      createTask('A'),
      createTask('B', ['A']),
      createTask('C', ['B']),
    ];

    const { state, history, graph } = createRuntime(tasks);

    state.start('A');
    state.complete('A', successResult('A'));

    state.start('B');
    state.complete('B', successResult('B'));

    state.start('C');
    state.complete('C', successResult('C'));

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics.criticalPath.taskIds).toEqual(['A', 'B', 'C']);
  });

  it('identifies failed tasks', () => {
    const { state, history, graph } = createRuntime([
      createTask('task-1'),
      createTask('task-2'),
    ]);

    state.start('task-1');
    state.complete('task-1', successResult('task-1'));

    state.start('task-2');
    state.fail('task-2', failureResult('task-2'));

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics.failedTaskIds).toEqual(['task-2']);
  });

  it('identifies blocked tasks', () => {
    const { state, history, graph } = createRuntime([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
    ]);

    state.start('task-1');
    state.fail('task-1', failureResult('task-1'));

    state.block('task-2');

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics.blockedTaskIds).toEqual(['task-2']);
  });

  it('identifies retried tasks', () => {
    const { state, history, graph } = createRuntime([createTask('task-1')]);

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

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics.retriedTaskIds).toEqual(['task-1']);
  });

  it('returns all execution events', () => {
    const { state, history, graph } = createRuntime([createTask('task-1')]);

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

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics.events).toHaveLength(2);
    expect(diagnostics.events.map((event) => event.type)).toEqual([
      'task_started',
      'task_completed',
    ]);
  });

  it('returns empty diagnostics for an empty execution', () => {
    const { state, history, graph } = createRuntime([]);

    const diagnostics = inspectExecution(state, history, graph);

    expect(diagnostics).toEqual({
      snapshot: {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
        finished: false,
        executions: [],
      },

      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        blockedTasks: 0,
        successRate: 0,
        totalDurationMs: 0,
        averageDurationMs: 0,
        retryCount: 0,
      },

      timeline: [],

      criticalPath: {
        taskIds: [],
        durationMs: 0,
      },

      failedTaskIds: [],
      blockedTaskIds: [],
      retriedTaskIds: [],
      events: [],
    });
  });
});
