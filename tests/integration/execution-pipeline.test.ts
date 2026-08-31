import { describe, expect, it } from 'vitest';
import { Executor } from '../../src/runtime/executor.js';

import type { Capability } from '../../src/core/capability.js';
import type { PhysicalPlan } from '../../src/core/physical-plan.js';
import type { Task } from '../../src/core/task.js';

import { DeterministicNode } from '../../src/nodes/deterministic-node.js';
import { NodeRegistry } from '../../src/runtime/registry.js';

import { NodeSelector } from '../../src/runtime/node-selector.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { PerformanceRegistry } from '../../src/runtime/performance-registry.js';

const capability = (aspect: string, quality = 1): Capability => ({
  aspect,
  quality,
  contextWindow: 4096,
  local: true,
});

const createTask = (
  id: string,
  dependencies: string[] = [],
  aspect = 'extract_requirements',
): Task => ({
  id,
  aspect,
  input: {
    id,
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

const createPlan = (
  tasks: Array<{
    task: Task;
    nodeId: string;
  }>,
): PhysicalPlan => ({
  tasks,
});

const createRegistry = (nodes: DeterministicNode[]): NodeRegistry => {
  const registry = new NodeRegistry();

  for (const node of nodes) {
    registry.register(node);
  }

  return registry;
};

const createExecutor = (nodes: DeterministicNode[]) => {
  const registry = createRegistry(nodes);
  const performanceRegistry = new PerformanceRegistry();

  const selector = new NodeSelector(
    new QualityFirstPolicy(),
    performanceRegistry,
  );

  return {
    registry,
    executor: new Executor(registry, selector),
  };
};

describe('execution pipeline integration', () => {
  it('executes a single deterministic task', async () => {
    const node = new DeterministicNode(
      'deterministic',
      (task) => ({
        echoed: task.input,
      }),
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);
    const planExecutor = new PlanExecutor(executor);

    const task = createTask('task-1');

    const results = await planExecutor.execute(
      createPlan([
        {
          task,
          nodeId: node.nodeId,
        },
      ]),
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      taskId: 'task-1',
      success: true,
      output: {
        echoed: {
          id: 'task-1',
        },
      },
      metadata: {
        nodeId: 'deterministic',
      },
    });
  });

  it('executes a linear dependency chain', async () => {
    const executed: string[] = [];

    const node = new DeterministicNode(
      'deterministic',
      (task) => {
        executed.push(task.id);

        return {
          taskId: task.id,
          dependencies: task.context.facts.dependencies,
        };
      },
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);
    const planExecutor = new PlanExecutor(executor);

    const tasks = [
      createTask('A'),
      createTask('B', ['A']),
      createTask('C', ['B']),
    ];

    const results = await planExecutor.execute(
      createPlan(
        tasks.map((task) => ({
          task,
          nodeId: node.nodeId,
        })),
      ),
    );

    expect(executed).toEqual(['A', 'B', 'C']);
    expect(results).toHaveLength(3);

    expect(
      results.find((result) => result.taskId === 'B')?.output,
    ).toMatchObject({
      taskId: 'B',
      dependencies: {
        A: expect.objectContaining({
          taskId: 'A',
          success: true,
        }),
      },
    });

    expect(
      results.find((result) => result.taskId === 'C')?.output,
    ).toMatchObject({
      taskId: 'C',
      dependencies: {
        B: expect.objectContaining({
          taskId: 'B',
          success: true,
        }),
      },
    });
  });

  it('executes independent tasks concurrently', async () => {
    let active = 0;
    let maximumActive = 0;

    const node = new DeterministicNode(
      'parallel-node',
      async (task) => {
        active++;
        maximumActive = Math.max(maximumActive, active);

        await new Promise((resolve) => setTimeout(resolve, 10));

        active--;

        return {
          taskId: task.id,
        };
      },
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);

    const planExecutor = new PlanExecutor(executor, undefined, 3);

    const tasks = [createTask('A'), createTask('B'), createTask('C')];

    const results = await planExecutor.execute(
      createPlan(
        tasks.map((task) => ({
          task,
          nodeId: node.nodeId,
        })),
      ),
    );

    expect(results).toHaveLength(3);
    expect(maximumActive).toBeGreaterThan(1);
  });

  it('respects max concurrency', async () => {
    let active = 0;
    let maximumActive = 0;

    const node = new DeterministicNode(
      'limited-node',
      async (task) => {
        active++;
        maximumActive = Math.max(maximumActive, active);

        await new Promise((resolve) => setTimeout(resolve, 10));

        active--;

        return {
          taskId: task.id,
        };
      },
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);

    const planExecutor = new PlanExecutor(executor, undefined, 2);

    const tasks = [
      createTask('A'),
      createTask('B'),
      createTask('C'),
      createTask('D'),
    ];

    await planExecutor.execute(
      createPlan(
        tasks.map((task) => ({
          task,
          nodeId: node.nodeId,
        })),
      ),
    );

    expect(maximumActive).toBeLessThanOrEqual(2);
  });

  it('propagates dependency failure into blocked tasks', async () => {
    const node = new DeterministicNode(
      'failure-node',
      (task) => {
        if (task.id === 'A') {
          throw new Error('boom');
        }

        return {
          taskId: task.id,
        };
      },
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);
    const planExecutor = new PlanExecutor(executor);

    const tasks = [createTask('A'), createTask('B', ['A'])];

    const results = await planExecutor.execute(
      createPlan(
        tasks.map((task) => ({
          task,
          nodeId: node.nodeId,
        })),
      ),
    );

    expect(results).toHaveLength(2);

    const snapshot = planExecutor.executionState.snapshot();

    expect(snapshot.failed).toBe(1);
    expect(snapshot.blocked).toBe(1);
    expect(snapshot.completed).toBe(0);

    expect(planExecutor.getHistory().byType('task_failed')).toHaveLength(1);

    expect(planExecutor.getHistory().byType('task_blocked')).toHaveLength(1);
  });

  it('records the complete execution history', async () => {
    const node = new DeterministicNode(
      'history-node',
      (task) => ({
        taskId: task.id,
      }),
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);
    const planExecutor = new PlanExecutor(executor);

    await planExecutor.execute(
      createPlan([
        {
          task: createTask('task-1'),
          nodeId: node.nodeId,
        },
      ]),
    );

    const history = planExecutor.getHistory();

    expect(history.forTask('task-1').map((event) => event.type)).toEqual([
      'task_started',
      'task_completed',
    ]);
  });

  it('produces a completed execution snapshot', async () => {
    const node = new DeterministicNode(
      'snapshot-node',
      () => ({
        value: 42,
      }),
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);
    const planExecutor = new PlanExecutor(executor);

    await planExecutor.execute(
      createPlan([
        {
          task: createTask('task-1'),
          nodeId: node.nodeId,
        },
      ]),
    );

    expect(planExecutor.executionState.snapshot()).toMatchObject({
      total: 1,
      pending: 0,
      running: 0,
      completed: 1,
      failed: 0,
      blocked: 0,
      finished: true,
    });
  });

  it('selects the requested physical node', async () => {
    const first = new DeterministicNode('first', () => 'first', [
      capability('extract_requirements', 1),
    ]);

    const second = new DeterministicNode('second', () => 'second', [
      capability('extract_requirements', 10),
    ]);

    const { executor } = createExecutor([first, second]);

    const task = createTask('task-1');

    const result = await executor.executeOn(task, first.nodeId);

    expect(result).toMatchObject({
      taskId: 'task-1',
      success: true,
      output: 'first',
      metadata: {
        nodeId: 'first',
      },
    });
  });

  it('keeps execution deterministic for deterministic nodes', async () => {
    const node = new DeterministicNode(
      'stable-node',
      (task) => ({
        id: task.id,
        value: 123,
      }),
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);

    const first = await executor.execute(createTask('task-1'));

    const second = await executor.execute(createTask('task-1'));

    expect(first).toEqual(second);
  });

  it('executes a diamond dependency graph correctly', async () => {
    const executionOrder: string[] = [];

    const node = new DeterministicNode(
      'diamond-node',
      (task) => {
        executionOrder.push(task.id);

        return {
          taskId: task.id,
        };
      },
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);
    const planExecutor = new PlanExecutor(executor);

    const tasks = [
      createTask('A'),
      createTask('B', ['A']),
      createTask('C', ['A']),
      createTask('D', ['B', 'C']),
    ];

    const results = await planExecutor.execute(
      createPlan(
        tasks.map((task) => ({
          task,
          nodeId: node.nodeId,
        })),
      ),
    );

    expect(results).toHaveLength(4);

    expect(executionOrder[0]).toBe('A');
    expect(executionOrder.indexOf('D')).toBeGreaterThan(
      executionOrder.indexOf('B'),
    );
    expect(executionOrder.indexOf('D')).toBeGreaterThan(
      executionOrder.indexOf('C'),
    );

    expect(planExecutor.executionState.snapshot()).toMatchObject({
      total: 4,
      completed: 4,
      failed: 0,
      blocked: 0,
      finished: true,
    });
  });

  it('does not execute a blocked task', async () => {
    const executed: string[] = [];

    const node = new DeterministicNode(
      'blocking-node',
      (task) => {
        executed.push(task.id);

        if (task.id === 'A') {
          throw new Error('failure');
        }

        return {
          taskId: task.id,
        };
      },
      [capability('extract_requirements', 1)],
    );

    const { executor } = createExecutor([node]);
    const planExecutor = new PlanExecutor(executor);

    await planExecutor.execute(
      createPlan([
        {
          task: createTask('A'),
          nodeId: node.nodeId,
        },
        {
          task: createTask('B', ['A']),
          nodeId: node.nodeId,
        },
      ]),
    );

    expect(executed).toEqual(['A']);
  });
});
