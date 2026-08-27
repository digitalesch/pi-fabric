import { describe, expect, it } from 'vitest';

import { TaskGraph } from '../../src/runtime/task-graph.js';
import type { Task } from '../../src/core/task.js';

function createTask(id: string, dependencies: string[] = []): Task {
  return {
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
  };
}

describe('TaskGraph', () => {
  it('identifies root tasks', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
    ]);

    expect(graph.roots().map((task) => task.id)).toEqual(['task-1']);
  });

  it('returns dependencies', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
    ]);

    expect(graph.dependencies('task-2')).toEqual(['task-1']);
  });

  it('returns direct dependents', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
      createTask('task-3', ['task-1']),
      createTask('task-4', ['task-2']),
    ]);

    expect(graph.dependents('task-1')).toEqual(['task-2', 'task-3']);

    expect(graph.dependents('task-2')).toEqual(['task-4']);
  });

  it('returns an empty list of dependents for a leaf task', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
    ]);

    expect(graph.dependents('task-2')).toEqual([]);
  });

  it('does not include transitive dependents', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
      createTask('task-3', ['task-2']),
    ]);

    expect(graph.dependents('task-1')).toEqual(['task-2']);
  });

  it('returns all tasks', () => {
    const graph = new TaskGraph([
      createTask('task-3'),
      createTask('task-1'),
      createTask('task-2'),
    ]);

    expect(graph.all().map((task) => task.id)).toEqual([
      'task-3',
      'task-1',
      'task-2',
    ]);
  });

  it('checks whether a task exists', () => {
    const graph = new TaskGraph([createTask('task-1')]);

    expect(graph.has('task-1')).toBe(true);
    expect(graph.has('missing')).toBe(false);
  });

  it('throws when requesting a missing task', () => {
    const graph = new TaskGraph([createTask('task-1')]);

    expect(() => graph.get('missing')).toThrow('Task not found: missing');
  });

  it('identifies root tasks in a larger graph', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
      createTask('task-3'),
      createTask('task-4', ['task-2', 'task-3']),
    ]);

    expect(graph.roots().map((task) => task.id)).toEqual(['task-1', 'task-3']);
  });

  it('finds tasks that are ready to execute', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
      createTask('task-3'),
      createTask('task-4', ['task-2', 'task-3']),
    ]);

    expect(graph.ready(new Set()).map((task) => task.id)).toEqual([
      'task-1',
      'task-3',
    ]);

    expect(graph.ready(new Set(['task-1'])).map((task) => task.id)).toEqual([
      'task-2',
      'task-3',
    ]);

    expect(
      graph
        .ready(new Set(['task-1', 'task-2', 'task-3']))
        .map((task) => task.id),
    ).toEqual(['task-4']);
  });

  it('does not return completed tasks as ready', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
    ]);

    expect(graph.ready(new Set(['task-1']))).not.toContain(graph.get('task-1'));
  });

  it('produces a topological order', () => {
    const graph = new TaskGraph([
      createTask('task-3', ['task-2']),
      createTask('task-1'),
      createTask('task-2', ['task-1']),
    ]);

    const order = graph.topologicalOrder().map((task) => task.id);

    expect(order.indexOf('task-1')).toBeLessThan(order.indexOf('task-2'));

    expect(order.indexOf('task-2')).toBeLessThan(order.indexOf('task-3'));
  });

  it('returns every task exactly once in topological order', () => {
    const graph = new TaskGraph([
      createTask('task-4', ['task-2', 'task-3']),
      createTask('task-2', ['task-1']),
      createTask('task-3', ['task-1']),
      createTask('task-1'),
    ]);

    const ordered = graph.topologicalOrder();

    expect(ordered).toHaveLength(4);

    expect(new Set(ordered.map((task) => task.id)).size).toBe(4);

    expect(ordered.map((task) => task.id)).toEqual([
      'task-1',
      'task-2',
      'task-3',
      'task-4',
    ]);
  });

  it('allows independent branches in the graph', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2', ['task-1']),
      createTask('task-3'),
      createTask('task-4', ['task-3']),
    ]);

    const order = graph.topologicalOrder().map((task) => task.id);

    expect(order).toHaveLength(4);
    expect(new Set(order)).toEqual(
      new Set(['task-1', 'task-2', 'task-3', 'task-4']),
    );

    expect(order.indexOf('task-1')).toBeLessThan(order.indexOf('task-2'));

    expect(order.indexOf('task-3')).toBeLessThan(order.indexOf('task-4'));
  });

  it('rejects duplicate task IDs', () => {
    expect(
      () => new TaskGraph([createTask('task-1'), createTask('task-1')]),
    ).toThrow('Duplicate task ID: task-1');
  });

  it('rejects duplicate dependencies', () => {
    expect(
      () =>
        new TaskGraph([
          createTask('task-1'),
          createTask('task-2', ['task-1', 'task-1']),
        ]),
    ).toThrow('Task task-2 has duplicate dependency: task-1');
  });

  it('rejects missing dependencies', () => {
    expect(() => new TaskGraph([createTask('task-1', ['missing'])])).toThrow(
      'Task task-1 depends on missing task: missing',
    );
  });

  it('rejects dependency cycles', () => {
    expect(
      () =>
        new TaskGraph([
          createTask('task-1', ['task-2']),
          createTask('task-2', ['task-1']),
        ]),
    ).toThrow('Dependency cycle detected involving task: task-1');
  });

  it('handles a task with multiple dependencies', () => {
    const graph = new TaskGraph([
      createTask('task-1'),
      createTask('task-2'),
      createTask('task-3', ['task-1', 'task-2']),
    ]);

    expect(graph.ready(new Set()).map((task) => task.id)).toEqual([
      'task-1',
      'task-2',
    ]);

    expect(graph.ready(new Set(['task-1'])).map((task) => task.id)).toEqual([
      'task-2',
    ]);

    expect(
      graph.ready(new Set(['task-1', 'task-2'])).map((task) => task.id),
    ).toEqual(['task-3']);
  });
});
