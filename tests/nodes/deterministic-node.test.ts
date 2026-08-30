import { describe, expect, it, vi } from 'vitest';

import type { Capability } from '../../src/core/capability.js';
import type { Task } from '../../src/core/task.js';
import { DeterministicNode } from '../../src/nodes/deterministic-node.js';

const createTask = (id = 'task-1'): Task => ({
  id,
  aspect: 'extract_requirements',
  input: {
    text: 'build a machine',
  },
  context: {
    facts: {
      language: 'typescript',
    },
    constraints: ['must be deterministic'],
    assumptions: ['input is valid'],
    references: ['reference-1'],
  },
  outputSchema: {
    type: 'object',
  },
  dependencies: [],
});

const capabilities: Capability[] = [
  {
    aspect: 'extract_requirements',
    quality: 1.0,
    contextWindow: 8192,
    local: true,
  },
];

describe('DeterministicNode', () => {
  it('reports healthy status', () => {
    const node = new DeterministicNode('deterministic', () => ({}));

    expect(node.health()).toEqual({
      status: 'healthy',
      latencyMs: 0,
      load: 0,
    });
  });

  it('reports zero latency', () => {
    const node = new DeterministicNode('deterministic', () => ({}));

    expect(node.health().latencyMs).toBe(0);
  });

  it('remains healthy after execution failure', async () => {
    const node = new DeterministicNode('deterministic', () => {
      throw new Error('boom');
    });

    await node.execute({
      id: 'task-1',
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

    expect(node.health().status).toBe('healthy');
  });
  it('exposes its ID', () => {
    const node = new DeterministicNode('deterministic-1', () => ({}));

    expect(node.nodeId).toBe('deterministic-1');
  });

  it('exposes its capabilities', () => {
    const node = new DeterministicNode(
      'deterministic-1',
      () => ({}),
      capabilities,
    );

    expect(node.capabilities()).toEqual(capabilities);
  });

  it('returns no capabilities when none are provided', () => {
    const node = new DeterministicNode('deterministic-1', () => ({}));

    expect(node.capabilities()).toEqual([]);
  });

  it('executes the handler with the original task', async () => {
    const handler = vi.fn(() => ({
      processed: true,
    }));

    const node = new DeterministicNode('deterministic-1', handler);

    const task = createTask();

    await node.execute(task);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(task);
  });

  it('returns a successful result', async () => {
    const node = new DeterministicNode('deterministic-1', () => ({
      processed: true,
    }));

    const result = await node.execute(createTask());

    expect(result).toEqual({
      taskId: 'task-1',
      success: true,
      output: {
        processed: true,
      },
      metadata: {
        nodeId: 'deterministic-1',
      },
    });
  });

  it('preserves arbitrary handler output', async () => {
    const output = {
      nested: {
        values: [1, 2, 3],
      },
      text: 'hello',
      value: null,
    };

    const node = new DeterministicNode('deterministic-1', () => output);

    const result = await node.execute(createTask());

    expect(result.output).toBe(output);
  });

  it('supports primitive handler output', async () => {
    const node = new DeterministicNode('deterministic-1', () => 'hello');

    const result = await node.execute(createTask());

    expect(result.success).toBe(true);
    expect(result.output).toBe('hello');
  });

  it('supports null handler output', async () => {
    const node = new DeterministicNode('deterministic-1', () => null);

    const result = await node.execute(createTask());

    expect(result.success).toBe(true);
    expect(result.output).toBeNull();
  });

  it('supports asynchronous handlers', async () => {
    const node = new DeterministicNode('deterministic-1', async () => ({
      processed: true,
    }));

    const result = await node.execute(createTask());

    expect(result.success).toBe(true);
    expect(result.output).toEqual({
      processed: true,
    });
  });

  it('waits for asynchronous handler completion', async () => {
    let resolved = false;

    const node = new DeterministicNode('deterministic-1', async () => {
      await Promise.resolve();
      resolved = true;

      return {
        processed: true,
      };
    });

    const result = await node.execute(createTask());

    expect(resolved).toBe(true);
    expect(result.success).toBe(true);
  });

  it('converts Error failures into failed results', async () => {
    const node = new DeterministicNode('deterministic-1', () => {
      throw new Error('something went wrong');
    });

    const result = await node.execute(createTask());

    expect(result).toEqual({
      taskId: 'task-1',
      success: false,
      output: null,
      metadata: {
        nodeId: 'deterministic-1',
      },
      error: {
        code: 'DETERMINISTIC_NODE_FAILURE',
        message: 'something went wrong',
      },
    });
  });

  it('converts asynchronous Error failures into failed results', async () => {
    const node = new DeterministicNode('deterministic-1', async () => {
      throw new Error('async failure');
    });

    const result = await node.execute(createTask());

    expect(result.success).toBe(false);
    expect(result.output).toBeNull();
    expect(result.error).toEqual({
      code: 'DETERMINISTIC_NODE_FAILURE',
      message: 'async failure',
    });
  });

  it('handles non-Error thrown values', async () => {
    const node = new DeterministicNode('deterministic-1', () => {
      throw 'failure';
    });

    const result = await node.execute(createTask());

    expect(result).toEqual({
      taskId: 'task-1',
      success: false,
      output: null,
      metadata: {
        nodeId: 'deterministic-1',
      },
      error: {
        code: 'DETERMINISTIC_NODE_FAILURE',
        message: 'failure',
      },
    });
  });

  it('handles numeric thrown values', async () => {
    const node = new DeterministicNode('deterministic-1', () => {
      throw 42;
    });

    const result = await node.execute(createTask());

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('42');
  });

  it('handles null thrown values', async () => {
    const node = new DeterministicNode('deterministic-1', () => {
      throw null;
    });

    const result = await node.execute(createTask());

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('null');
  });

  it('preserves the task ID on failure', async () => {
    const node = new DeterministicNode('deterministic-1', () => {
      throw new Error('failure');
    });

    const result = await node.execute(createTask('custom-task'));

    expect(result.taskId).toBe('custom-task');
  });

  it('preserves the node ID on failure', async () => {
    const node = new DeterministicNode('my-node', () => {
      throw new Error('failure');
    });

    const result = await node.execute(createTask());

    expect(result.metadata.nodeId).toBe('my-node');
  });

  it('does not mutate the task', async () => {
    const task = createTask();

    const before = structuredClone(task);

    const node = new DeterministicNode('deterministic-1', (receivedTask) => {
      return {
        taskId: receivedTask.id,
      };
    });

    await node.execute(task);

    expect(task).toEqual(before);
  });

  it('can execute multiple tasks independently', async () => {
    const node = new DeterministicNode('deterministic-1', (task) => ({
      processedTask: task.id,
    }));

    const first = await node.execute(createTask('task-1'));

    const second = await node.execute(createTask('task-2'));

    expect(first.output).toEqual({
      processedTask: 'task-1',
    });

    expect(second.output).toEqual({
      processedTask: 'task-2',
    });
  });

  it('does not retain execution state between tasks', async () => {
    let executions = 0;

    const node = new DeterministicNode('deterministic-1', () => {
      executions++;

      return {
        execution: executions,
      };
    });

    const first = await node.execute(createTask('task-1'));

    const second = await node.execute(createTask('task-2'));

    expect(first.output).toEqual({
      execution: 1,
    });

    expect(second.output).toEqual({
      execution: 2,
    });
  });
});
