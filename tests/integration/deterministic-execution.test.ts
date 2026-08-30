import { describe, expect, it, vi } from 'vitest';

import type { PhysicalPlan } from '../../src/core/physical-plan.js';
import type { Task } from '../../src/core/task.js';

import { DeterministicNode } from '../../src/nodes/deterministic-node.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { NodeRegistry } from '../../src/runtime/registry.js';

import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';

import { Executor } from '../../src/runtime/executor.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';

const createTask = (id: string, dependencies: string[] = []): Task => ({
  id,
  aspect: 'extract_requirements',
  input: {
    value: id,
  },
  context: {
    facts: {},
    constraints: [],
    assumptions: [],
    references: [],
  },
  outputSchema: {},
  dependencies,
});

const createNode = (
  nodeId = 'deterministic-node',
  handler: (task: Task) => unknown | Promise<unknown> = (task) => ({
    processed: task.id,
  }),
) =>
  new DeterministicNode(nodeId, handler, [
    {
      aspect: 'extract_requirements',
      quality: 1.0,
      contextWindow: 8192,
      local: true,
    },
  ]);

const createStack = (
  handler?: (task: Task) => unknown | Promise<unknown>,
  maxConcurrency = Infinity,
) => {
  const registry = new NodeRegistry();

  const node = createNode('deterministic-node', handler);

  registry.register(node);

  const selector = new NodeSelector(new QualityFirstPolicy());

  const executor = new Executor(registry, selector);

  const planExecutor = new PlanExecutor(executor, undefined, maxConcurrency);

  return {
    registry,
    node,
    selector,
    executor,
    planExecutor,
  };
};

const physicalPlan = (
  tasks: Task[],
  nodeId = 'deterministic-node',
): PhysicalPlan => ({
  tasks: tasks.map((task) => ({
    task,
    nodeId,
  })),
});

describe('DeterministicNode integration', () => {
  it('executes a task through the complete runtime', async () => {
    const { planExecutor } = createStack();

    const plan = physicalPlan([createTask('task-1')]);

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(1);

    expect(results[0]).toEqual({
      taskId: 'task-1',
      success: true,
      output: {
        processed: 'task-1',
      },
      metadata: {
        nodeId: 'deterministic-node',
      },
    });
  });

  it('passes the task through the runtime to the node', async () => {
    const handler = vi.fn((task: Task) => ({
      received: task.id,
    }));

    const { planExecutor } = createStack(handler);

    await planExecutor.execute(physicalPlan([createTask('task-1')]));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].id).toBe('task-1');
  });

  it('executes a linear dependency chain', async () => {
    const order: string[] = [];

    const { planExecutor } = createStack((task) => {
      order.push(task.id);

      return {
        processed: task.id,
      };
    });

    const plan = physicalPlan([
      createTask('A'),
      createTask('B', ['A']),
      createTask('C', ['B']),
    ]);

    const results = await planExecutor.execute(plan);

    expect(order).toEqual(['A', 'B', 'C']);

    expect(results.every((result) => result.success)).toBe(true);

    expect(planExecutor.executionState.snapshot().completed).toBe(3);
  });

  it('executes independent tasks concurrently', async () => {
    let active = 0;
    let maximumConcurrency = 0;

    const { planExecutor } = createStack(async (task) => {
      active++;

      maximumConcurrency = Math.max(maximumConcurrency, active);

      await new Promise((resolve) => setTimeout(resolve, 10));

      active--;

      return {
        processed: task.id,
      };
    }, 3);

    const plan = physicalPlan([
      createTask('A'),
      createTask('B'),
      createTask('C'),
    ]);

    await planExecutor.execute(plan);

    expect(maximumConcurrency).toBe(3);

    expect(planExecutor.executionState.snapshot().completed).toBe(3);
  });

  it('respects the concurrency limit', async () => {
    let active = 0;
    let maximumConcurrency = 0;

    const { planExecutor } = createStack(async (task) => {
      active++;

      maximumConcurrency = Math.max(maximumConcurrency, active);

      await new Promise((resolve) => setTimeout(resolve, 10));

      active--;

      return {
        processed: task.id,
      };
    }, 2);

    const plan = physicalPlan([
      createTask('A'),
      createTask('B'),
      createTask('C'),
      createTask('D'),
    ]);

    await planExecutor.execute(plan);

    expect(maximumConcurrency).toBeLessThanOrEqual(2);

    expect(planExecutor.executionState.snapshot().completed).toBe(4);
  });

  it('passes dependency results into dependent tasks', async () => {
    const received: Record<string, unknown> = {};

    const { planExecutor } = createStack((task) => {
      received[task.id] = task.context.facts.dependencies;

      return {
        value: task.id,
      };
    });

    const plan = physicalPlan([createTask('A'), createTask('B', ['A'])]);

    await planExecutor.execute(plan);

    expect(received.B).toEqual({
      A: expect.objectContaining({
        taskId: 'A',
        success: true,
      }),
    });
  });

  it('records task start and completion events', async () => {
    const { planExecutor } = createStack();

    await planExecutor.execute(physicalPlan([createTask('task-1')]));

    const events = planExecutor.getHistory().forTask('task-1');

    expect(events.map((event) => event.type)).toEqual([
      'task_started',
      'task_completed',
    ]);
  });

  it('records failed task execution', async () => {
    const { planExecutor } = createStack(() => {
      throw new Error('boom');
    });

    const results = await planExecutor.execute(
      physicalPlan([createTask('task-1')]),
    );

    expect(results[0]).toMatchObject({
      taskId: 'task-1',
      success: false,
    });

    expect(planExecutor.executionState.get('task-1').status).toBe('failed');

    expect(
      planExecutor
        .getHistory()
        .forTask('task-1')
        .map((event) => event.type),
    ).toEqual(['task_started', 'task_failed']);
  });

  it('blocks dependent tasks after failure', async () => {
    const executed: string[] = [];

    const { planExecutor } = createStack((task) => {
      executed.push(task.id);

      if (task.id === 'A') {
        throw new Error('A failed');
      }

      return {
        processed: task.id,
      };
    });

    const plan = physicalPlan([createTask('A'), createTask('B', ['A'])]);

    const results = await planExecutor.execute(plan);

    expect(executed).toEqual(['A']);

    expect(planExecutor.executionState.get('A').status).toBe('failed');

    expect(planExecutor.executionState.get('B').status).toBe('blocked');

    expect(
      planExecutor
        .getHistory()
        .forTask('B')
        .map((event) => event.type),
    ).toEqual(['task_blocked']);

    expect(results).toHaveLength(2);
  });

  it('supports diamond dependency graphs', async () => {
    const executed: string[] = [];

    const { planExecutor } = createStack((task) => {
      executed.push(task.id);

      return {
        processed: task.id,
      };
    });

    const plan = physicalPlan([
      createTask('A'),
      createTask('B', ['A']),
      createTask('C', ['A']),
      createTask('D', ['B', 'C']),
    ]);

    await planExecutor.execute(plan);

    expect(executed[0]).toBe('A');

    expect(new Set(executed)).toEqual(new Set(['A', 'B', 'C', 'D']));

    expect(planExecutor.executionState.snapshot().completed).toBe(4);
  });

  it('handles multiple independent roots', async () => {
    const { planExecutor } = createStack();

    const plan = physicalPlan([
      createTask('A'),
      createTask('B'),
      createTask('C', ['A']),
      createTask('D', ['B']),
    ]);

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(4);

    expect(results.every((result) => result.success)).toBe(true);
  });

  it('keeps node selection outside the deterministic node', async () => {
    const registry = new NodeRegistry();

    const lowQuality = new DeterministicNode(
      'low-quality',
      (task) => ({
        selected: task.id,
        node: 'low',
      }),
      [
        {
          aspect: 'extract_requirements',
          quality: 0.5,
          contextWindow: 8192,
          local: true,
        },
      ],
    );

    const highQuality = new DeterministicNode(
      'high-quality',
      (task) => ({
        selected: task.id,
        node: 'high',
      }),
      [
        {
          aspect: 'extract_requirements',
          quality: 1.0,
          contextWindow: 8192,
          local: true,
        },
      ],
    );

    registry.register(lowQuality);
    registry.register(highQuality);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(registry, selector);

    const planExecutor = new PlanExecutor(executor);

    const results = await planExecutor.execute(
      physicalPlan([createTask('task-1')], 'high-quality'),
    );

    expect(results[0].output).toEqual({
      selected: 'task-1',
      node: 'high',
    });
  });

  it('does not require a real model to execute', async () => {
    const { planExecutor } = createStack();

    const results = await planExecutor.execute(
      physicalPlan([createTask('model-free')]),
    );

    expect(results[0].success).toBe(true);

    expect(results[0].metadata.nodeId).toBe('deterministic-node');
  });

  it('produces a finished execution snapshot', async () => {
    const { planExecutor } = createStack();

    await planExecutor.execute(
      physicalPlan([createTask('A'), createTask('B')]),
    );

    const snapshot = planExecutor.executionState.snapshot();

    expect(snapshot).toMatchObject({
      total: 2,
      pending: 0,
      running: 0,
      completed: 2,
      failed: 0,
      blocked: 0,
      finished: true,
    });
  });
});
