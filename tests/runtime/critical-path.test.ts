import { describe, expect, it } from 'vitest';

import type { ExecutionSnapshot } from '../../src/core/execution-snapshot.js';
import type { TaskExecution } from '../../src/core/task-execution.js';

import { TaskGraph } from '../../src/runtime/task-graph.js';
import { calculateCriticalPath } from '../../src/runtime/critical-path.js';

const execution = (
  taskId: string,
  durationMs: number | undefined,
  status: TaskExecution['status'] = 'completed',
): TaskExecution => ({
  taskId,
  status,
  ...(durationMs !== undefined ? { durationMs } : {}),
});

const snapshot = (executions: TaskExecution[]): ExecutionSnapshot => ({
  total: executions.length,
  pending: executions.filter((execution) => execution.status === 'pending')
    .length,
  running: executions.filter((execution) => execution.status === 'running')
    .length,
  completed: executions.filter((execution) => execution.status === 'completed')
    .length,
  failed: executions.filter((execution) => execution.status === 'failed')
    .length,
  blocked: executions.filter((execution) => execution.status === 'blocked')
    .length,
  finished: executions.every(
    (execution) =>
      execution.status === 'completed' ||
      execution.status === 'failed' ||
      execution.status === 'blocked',
  ),
  executions,
});

const task = (id: string, dependencies: string[] = []) => ({
  id,
  aspect: 'extract_requirements' as const,
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

describe('calculateCriticalPath', () => {
  it('calculates the critical path for a single task', () => {
    const graph = new TaskGraph([task('A')]);

    const result = calculateCriticalPath(graph, snapshot([execution('A', 10)]));

    expect(result).toEqual({
      taskIds: ['A'],
      durationMs: 10,
    });
  });

  it('calculates a linear critical path', () => {
    const graph = new TaskGraph([
      task('A'),
      task('B', ['A']),
      task('C', ['B']),
    ]);

    const result = calculateCriticalPath(
      graph,
      snapshot([execution('A', 5), execution('B', 10), execution('C', 20)]),
    );

    expect(result).toEqual({
      taskIds: ['A', 'B', 'C'],
      durationMs: 35,
    });
  });

  it('selects the longest parallel branch', () => {
    const graph = new TaskGraph([
      task('A'),
      task('B', ['A']),
      task('C', ['A']),
    ]);

    const result = calculateCriticalPath(
      graph,
      snapshot([execution('A', 5), execution('B', 10), execution('C', 30)]),
    );

    expect(result).toEqual({
      taskIds: ['A', 'C'],
      durationMs: 35,
    });
  });

  it('calculates the critical path through a diamond DAG', () => {
    const graph = new TaskGraph([
      task('A'),
      task('B', ['A']),
      task('C', ['A']),
      task('D', ['B', 'C']),
    ]);

    const result = calculateCriticalPath(
      graph,
      snapshot([
        execution('A', 5),
        execution('B', 10),
        execution('C', 30),
        execution('D', 2),
      ]),
    );

    expect(result).toEqual({
      taskIds: ['A', 'C', 'D'],
      durationMs: 37,
    });
  });

  it('selects the longest path when there are multiple roots', () => {
    const graph = new TaskGraph([
      task('A'),
      task('B', ['A']),
      task('C'),
      task('D', ['C']),
      task('E', ['D']),
    ]);

    const result = calculateCriticalPath(
      graph,
      snapshot([
        execution('A', 5),
        execution('B', 10),
        execution('C', 20),
        execution('D', 15),
        execution('E', 10),
      ]),
    );

    expect(result).toEqual({
      taskIds: ['C', 'D', 'E'],
      durationMs: 45,
    });
  });

  it('handles zero-duration tasks', () => {
    const graph = new TaskGraph([
      task('A'),
      task('B', ['A']),
      task('C', ['B']),
    ]);

    const result = calculateCriticalPath(
      graph,
      snapshot([execution('A', 0), execution('B', 10), execution('C', 0)]),
    );

    expect(result).toEqual({
      taskIds: ['A', 'B', 'C'],
      durationMs: 10,
    });
  });

  it('rejects a task without a duration', () => {
    const graph = new TaskGraph([task('A')]);

    expect(() =>
      calculateCriticalPath(graph, snapshot([execution('A', undefined)])),
    ).toThrow('Task has no execution duration: A');
  });

  it('includes failed tasks in the critical path', () => {
    const graph = new TaskGraph([task('A'), task('B', ['A'])]);

    const result = calculateCriticalPath(
      graph,
      snapshot([execution('A', 10, 'completed'), execution('B', 20, 'failed')]),
    );

    expect(result).toEqual({
      taskIds: ['A', 'B'],
      durationMs: 30,
    });
  });

  it('ignores blocked tasks', () => {
    const graph = new TaskGraph([task('A'), task('B', ['A']), task('C')]);

    const result = calculateCriticalPath(
      graph,
      snapshot([
        execution('A', 10, 'completed'),
        execution('B', undefined, 'blocked'),
        execution('C', 20, 'completed'),
      ]),
    );

    expect(result).toEqual({
      taskIds: ['C'],
      durationMs: 20,
    });
  });

  it('ignores pending and running tasks', () => {
    const graph = new TaskGraph([task('A'), task('B')]);

    const result = calculateCriticalPath(
      graph,
      snapshot([execution('A', 10, 'pending'), execution('B', 20, 'running')]),
    );

    expect(result).toEqual({
      taskIds: [],
      durationMs: 0,
    });
  });

  it('throws when a dependency execution is missing', () => {
    const graph = new TaskGraph([task('A'), task('B', ['A'])]);

    expect(() =>
      calculateCriticalPath(graph, snapshot([execution('B', 20)])),
    ).toThrow('Execution not found for task: A');
  });

  it('rejects cyclic graphs through TaskGraph validation', () => {
    expect(() => new TaskGraph([task('A', ['B']), task('B', ['A'])])).toThrow();
  });

  it('returns a deterministic path when equal paths exist', () => {
    const graph = new TaskGraph([
      task('A'),
      task('B', ['A']),
      task('C', ['A']),
    ]);

    const result = calculateCriticalPath(
      graph,
      snapshot([execution('A', 5), execution('B', 10), execution('C', 10)]),
    );

    expect(result.durationMs).toBe(15);
    expect(result.taskIds).toEqual(['A', 'B']);
  });
});
