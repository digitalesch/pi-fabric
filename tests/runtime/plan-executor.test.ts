import { describe, expect, it } from 'vitest';

import type { Capability } from '../../src/core/capability.js';
import type { PhysicalPlan } from '../../src/core/physical-plan.js';
import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';
import type { ModelNode } from '../../src/nodes/node.js';
import { Executor } from '../../src/runtime/executor.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { Planner } from '../../src/runtime/planner.js';
import { RecordingNode } from '../helpers/recording-node.js';
import { ConcurrencyNode } from '../helpers/concurrency-node.js';
import { DelayedNode } from '../helpers/delayed-node.js';

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

function makeTask(id: string, dependencies: string[] = []): Task {
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

describe('PlanExecutor execution state', () => {
  it('tracks successful task execution', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new RecordingNode('node');

    nodeRegistry.register(node);

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
    );

    const taskExecutor = new Executor(
      nodeRegistry,
      selector,
    );

    const planExecutor = new PlanExecutor(
      taskExecutor,
    );

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'node',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(1);

    expect(
      planExecutor.executionState.get('task-1'),
    ).toMatchObject({
      taskId: 'task-1',
      status: 'completed',
      result: results[0],
    });
  });

  it('tracks failed task execution', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new RecordingNode('node');

    const originalExecute = node.execute.bind(node);

    node.execute = async (task) => {
      await originalExecute(task);

      return {
        taskId: task.id,
        success: false,
        output: null,
        metadata: {
          nodeId: node.id,
        },
        error: {
          code: 'TEST_FAILURE',
          message: 'Task failed',
        },
      };
    };

    nodeRegistry.register(node);

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
    );

    const taskExecutor = new Executor(
      nodeRegistry,
      selector,
    );

    const planExecutor = new PlanExecutor(
      taskExecutor,
    );

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'node',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);

    expect(
      planExecutor.executionState.get('task-1'),
    ).toMatchObject({
      taskId: 'task-1',
      status: 'failed',
      result: results[0],
    });
  });

  it('tracks blocked dependent tasks', async () => {
    const nodeRegistry = new NodeRegistry();

    const failingNode = new RecordingNode('failing-node');
    const dependentNode = new RecordingNode('dependent-node');

    const originalExecute =
      failingNode.execute.bind(failingNode);

    failingNode.execute = async (task) => {
      await originalExecute(task);

      return {
        taskId: task.id,
        success: false,
        output: null,
        metadata: {
          nodeId: failingNode.id,
        },
        error: {
          code: 'TEST_FAILURE',
          message: 'Task failed',
        },
      };
    };

    nodeRegistry.register(failingNode);
    nodeRegistry.register(dependentNode);

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
    );

    const taskExecutor = new Executor(
      nodeRegistry,
      selector,
    );

    const planExecutor = new PlanExecutor(
      taskExecutor,
    );

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'failing-node',
        },
        {
          task: {
            id: 'task-2',
            aspect: 'extract_requirements',
            input: {},
            context: {
              facts: {},
              constraints: [],
              assumptions: [],
              references: [],
            },
            outputSchema: {},
            dependencies: ['task-1'],
          },
          nodeId: 'dependent-node',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(2);

    expect(
      planExecutor.executionState.get('task-1'),
    ).toMatchObject({
      taskId: 'task-1',
      status: 'failed',
    });

    expect(
      planExecutor.executionState.get('task-2'),
    ).toMatchObject({
      taskId: 'task-2',
      status: 'blocked',
    });

    expect(dependentNode.receivedTasks).toHaveLength(0);
  });

  it('exposes all task execution states', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new RecordingNode('node');

    nodeRegistry.register(node);

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
    );

    const taskExecutor = new Executor(
      nodeRegistry,
      selector,
    );

    const planExecutor = new PlanExecutor(
      taskExecutor,
    );

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'node',
        },
        {
          task: {
            id: 'task-2',
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
          },
          nodeId: 'node',
        },
      ],
    };

    await planExecutor.execute(plan);

    expect(
      planExecutor.executionState.all(),
    ).toMatchObject([
      {
        taskId: 'task-1',
        status: 'completed',
      },
      {
        taskId: 'task-2',
        status: 'completed',
      },
    ]);
  });

  it('executes independent tasks concurrently', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new RecordingNode('node');

    nodeRegistry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const taskExecutor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(taskExecutor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'node',
        },
        {
          task: {
            id: 'task-2',
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
          },
          nodeId: 'node',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.taskId)).toEqual([
      'task-1',
      'task-2',
    ]);

    expect(node.receivedTasks).toHaveLength(2);
  });

  it('does not execute a dependent task before its dependency completes', async () => {
    const nodeRegistry = new NodeRegistry();

    const executionOrder: string[] = [];

    const node = new RecordingNode('node');

    const originalExecute = node.execute.bind(node);

    node.execute = async (task) => {
      executionOrder.push(`start:${task.id}`);

      const result = await originalExecute(task);

      executionOrder.push(`end:${task.id}`);

      return result;
    };

    nodeRegistry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const taskExecutor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(taskExecutor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'node',
        },
        {
          task: {
            id: 'task-2',
            aspect: 'extract_requirements',
            input: {},
            context: {
              facts: {},
              constraints: [],
              assumptions: [],
              references: [],
            },
            outputSchema: {},
            dependencies: ['task-1'],
          },
          nodeId: 'node',
        },
      ],
    };

    await planExecutor.execute(plan);

    expect(executionOrder.indexOf('end:task-1')).toBeLessThan(
      executionOrder.indexOf('start:task-2'),
    );
  });

  it('respects maxConcurrency', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new RecordingNode('node');

    let active = 0;
    let maximumActive = 0;

    const originalExecute = node.execute.bind(node);

    node.execute = async (task) => {
      active++;
      maximumActive = Math.max(maximumActive, active);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await originalExecute(task);

      active--;

      return result;
    };

    nodeRegistry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const taskExecutor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(taskExecutor, 2);

    const plan: PhysicalPlan = {
      tasks: Array.from({ length: 6 }, (_, index) => ({
        task: {
          id: `task-${index + 1}`,
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
        },
        nodeId: 'node',
      })),
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(6);
    expect(maximumActive).toBeLessThanOrEqual(2);
  });

  it('allows independent branches to execute in the same batch', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new RecordingNode('node');

    const executionOrder: string[] = [];

    const originalExecute = node.execute.bind(node);

    node.execute = async (task) => {
      executionOrder.push(`start:${task.id}`);

      const result = await originalExecute(task);

      executionOrder.push(`end:${task.id}`);

      return result;
    };

    nodeRegistry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const taskExecutor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(taskExecutor, 2);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
            id: 'task-a',
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
          },
          nodeId: 'node',
        },
        {
          task: {
            id: 'task-b',
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
          },
          nodeId: 'node',
        },
        {
          task: {
            id: 'task-c',
            aspect: 'extract_requirements',
            input: {},
            context: {
              facts: {},
              constraints: [],
              assumptions: [],
              references: [],
            },
            outputSchema: {},
            dependencies: ['task-a'],
          },
          nodeId: 'node',
        },
        {
          task: {
            id: 'task-d',
            aspect: 'extract_requirements',
            input: {},
            context: {
              facts: {},
              constraints: [],
              assumptions: [],
              references: [],
            },
            outputSchema: {},
            dependencies: ['task-b'],
          },
          nodeId: 'node',
        },
      ],
    };

    await planExecutor.execute(plan);

    expect(executionOrder.indexOf('end:task-a')).toBeLessThan(
      executionOrder.indexOf('start:task-c'),
    );

    expect(executionOrder.indexOf('end:task-b')).toBeLessThan(
      executionOrder.indexOf('start:task-d'),
    );
  });

  it('executes tasks in dependency order', async () => {
    const executionOrder: string[] = [];

    const node = new RecordingNode('node-1', {
      aspect: 'extract_requirements',
      quality: 0.8,
      contextWindow: 8192,
      local: true,
    });

    const originalExecute = node.execute.bind(node);

    node.execute = async (task) => {
      executionOrder.push(task.id);
      return originalExecute(task);
    };

    const registry = new NodeRegistry();
    registry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(registry, selector);

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: createTask('task-3', ['task-2']),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-1', []),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-2', ['task-1']),
          nodeId: 'node-1',
        },
      ],
    };

    await planExecutor.execute(plan);

    expect(executionOrder).toEqual(['task-1', 'task-2', 'task-3']);
  });

  it('executes independent tasks concurrently', async () => {
    const started: string[] = [];
    const finished: string[] = [];

    const node = new RecordingNode('node-1', {
      aspect: 'extract_requirements',
      quality: 0.8,
      contextWindow: 8192,
      local: true,
    });

    node.execute = async (task) => {
      started.push(task.id);

      await new Promise((resolve) => setTimeout(resolve, 20));

      finished.push(task.id);

      return {
        taskId: task.id,
        success: true,
        output: null,
        metadata: {
          nodeId: node.id,
        },
      };
    };

    const registry = new NodeRegistry();
    registry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(registry, selector);

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: createTask('task-1', []),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-2', []),
          nodeId: 'node-1',
        },
      ],
    };

    await planExecutor.execute(plan);

    expect(started).toEqual(['task-1', 'task-2']);

    expect(finished).toHaveLength(2);
  });

  it('respects maxConcurrency', async () => {
    let active = 0;
    let maximumActive = 0;

    const node = new RecordingNode('node-1', {
      aspect: 'extract_requirements',
      quality: 0.8,
      contextWindow: 8192,
      local: true,
    });

    node.execute = async (task) => {
      active++;
      maximumActive = Math.max(maximumActive, active);

      await new Promise((resolve) => setTimeout(resolve, 20));

      active--;

      return {
        taskId: task.id,
        success: true,
        output: null,
        metadata: {
          nodeId: node.id,
        },
      };
    };

    const registry = new NodeRegistry();
    registry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(registry, selector);

    const planExecutor = new PlanExecutor(executor, 2);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: createTask('task-1', []),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-2', []),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-3', []),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-4', []),
          nodeId: 'node-1',
        },
      ],
    };

    await planExecutor.execute(plan);

    expect(maximumActive).toBe(2);
  });

  it('passes dependency results to dependent tasks', async () => {
    let receivedDependencies: unknown;

    const node = new RecordingNode('node-1');

    node.execute = async (task) => {
      receivedDependencies = task.context.facts.dependencies;

      return {
        taskId: task.id,
        success: true,
        output: {
          value: task.id,
        },
        metadata: {
          nodeId: node.id,
        },
      };
    };

    const registry = new NodeRegistry();
    registry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(registry, selector);

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: createTask('task-1', []),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-2', ['task-1']),
          nodeId: 'node-1',
        },
      ],
    };

    await planExecutor.execute(plan);

    expect(receivedDependencies).toEqual({
      'task-1': expect.objectContaining({
        taskId: 'task-1',
        success: true,
      }),
    });
  });

  it('does not execute a task when a dependency fails', async () => {
    const executedTasks: string[] = [];

    const node = new RecordingNode('node-1');

    node.execute = async (task) => {
      executedTasks.push(task.id);

      if (task.id === 'task-1') {
        return {
          taskId: task.id,
          success: false,
          output: null,
          metadata: {
            nodeId: node.id,
          },
          error: {
            code: 'TEST_FAILURE',
            message: 'intentional failure',
          },
        };
      }

      return {
        taskId: task.id,
        success: true,
        output: null,
        metadata: {
          nodeId: node.id,
        },
      };
    };

    const registry = new NodeRegistry();
    registry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(registry, selector);

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: createTask('task-1', []),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-2', ['task-1']),
          nodeId: 'node-1',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(executedTasks).toEqual(['task-1']);

    expect(results).toHaveLength(2);

    const dependencyFailure = results.find(
      (result) => result.taskId === 'task-2',
    );

    expect(dependencyFailure).toMatchObject({
      taskId: 'task-2',
      success: false,
      error: {
        code: 'DEPENDENCY_FAILED',
      },
    });
  });

  it('propagates failure through a dependency chain', async () => {
    const executedTasks: string[] = [];

    const node = new RecordingNode('node-1');

    node.execute = async (task) => {
      executedTasks.push(task.id);

      return {
        taskId: task.id,
        success: false,
        output: null,
        metadata: {
          nodeId: node.id,
        },
        error: {
          code: 'TEST_FAILURE',
          message: 'intentional failure',
        },
      };
    };

    const registry = new NodeRegistry();
    registry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(registry, selector);

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: createTask('task-1', []),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-2', ['task-1']),
          nodeId: 'node-1',
        },
        {
          task: createTask('task-3', ['task-2']),
          nodeId: 'node-1',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(executedTasks).toEqual(['task-1']);

    expect(results).toHaveLength(3);

    expect(results.find((result) => result.taskId === 'task-2')).toMatchObject({
      success: false,
      error: {
        code: 'DEPENDENCY_FAILED',
      },
    });

    expect(results.find((result) => result.taskId === 'task-3')).toMatchObject({
      success: false,
      error: {
        code: 'DEPENDENCY_FAILED',
      },
    });
  });

  it('rejects an unresolved dependency graph', async () => {
    const node = new RecordingNode('node-1');

    const registry = new NodeRegistry();
    registry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(registry, selector);

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: createTask('task-1', ['missing-task']),
          nodeId: 'node-1',
        },
      ],
    };

    await expect(planExecutor.execute(plan)).rejects.toThrow(
      'Task task-1 depends on missing task: missing',
    );
  });

  it('executes independent tasks concurrently', async () => {
    const events: string[] = [];

    const registry = new NodeRegistry();

    registry.register(new DelayedNode('node-1', 50, events));

    registry.register(new DelayedNode('node-2', 50, events));

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: makeTask('task-1'),
          nodeId: 'node-1',
        },
        {
          task: makeTask('task-2'),
          nodeId: 'node-2',
        },
      ],
    };

    const start = Date.now();

    const results = await planExecutor.execute(plan);

    const elapsed = Date.now() - start;

    expect(results).toHaveLength(2);

    expect(elapsed).toBeLessThan(90);

    expect(events.indexOf('task-1:start')).toBeLessThan(
      events.indexOf('task-2:end'),
    );

    expect(events.indexOf('task-2:start')).toBeLessThan(
      events.indexOf('task-1:end'),
    );
  });

  it('waits for all dependencies before executing a task', async () => {
    const events: string[] = [];

    const registry = new NodeRegistry();

    registry.register(new DelayedNode('node-1', 30, events));

    registry.register(new DelayedNode('node-2', 30, events));

    registry.register(new DelayedNode('node-3', 10, events));

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: makeTask('task-1'),
          nodeId: 'node-1',
        },
        {
          task: makeTask('task-2'),
          nodeId: 'node-2',
        },
        {
          task: makeTask('task-3', ['task-1', 'task-2']),
          nodeId: 'node-3',
        },
      ],
    };

    await planExecutor.execute(plan);

    const task3Start = events.indexOf('task-3:start');

    const task1End = events.indexOf('task-1:end');

    const task2End = events.indexOf('task-2:end');

    expect(task3Start).toBeGreaterThan(task1End);

    expect(task3Start).toBeGreaterThan(task2End);
  });

  it('limits concurrent task execution', async () => {
    const events: string[] = [];

    const node = new DelayedNode('node-1', 50, events);

    const registry = new NodeRegistry();

    registry.register(node);

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const planExecutor = new PlanExecutor(executor, 2);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: makeTask('task-1'),
          nodeId: 'node-1',
        },
        {
          task: makeTask('task-2'),
          nodeId: 'node-1',
        },
        {
          task: makeTask('task-3'),
          nodeId: 'node-1',
        },
        {
          task: makeTask('task-4'),
          nodeId: 'node-1',
        },
      ],
    };

    const start = Date.now();

    const results = await planExecutor.execute(plan);

    const elapsed = Date.now() - start;

    expect(results).toHaveLength(4);

    expect(node.maxActive).toBe(2);

    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it('does not execute a task when a dependency fails', async () => {
    const events: string[] = [];

    class FailingNode implements ModelNode {
      constructor(public readonly id: string) {}

      capabilities(): Capability[] {
        return [];
      }

      async execute(task: Task): Promise<Result> {
        events.push(`${task.id}:start`);

        return {
          taskId: task.id,
          success: false,
          output: null,
          metadata: {
            nodeId: this.id,
          },
          error: {
            code: 'EXECUTION_FAILED',
            message: 'simulated failure',
          },
        };
      }
    }

    const registry = new NodeRegistry();

    registry.register(new FailingNode('node-1'));

    registry.register(new DelayedNode('node-2', 10, events));

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const planExecutor = new PlanExecutor(executor, 2);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: makeTask('task-1'),
          nodeId: 'node-1',
        },
        {
          task: makeTask('task-2', ['task-1']),
          nodeId: 'node-2',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(2);

    expect(results[0].success).toBe(false);

    expect(results[1].success).toBe(false);

    expect(results[1].error?.code).toBe('DEPENDENCY_FAILED');

    expect(events).not.toContain('task-2:start');
  });

  it('passes dependency results to dependent tasks', async () => {
    const registry = new NodeRegistry();

    const upstream = new RecordingNode('upstream');

    const downstream = new RecordingNode('downstream');

    registry.register(upstream);
    registry.register(downstream);

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const planExecutor = new PlanExecutor(executor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: makeTask('task-1'),
          nodeId: 'upstream',
        },
        {
          task: makeTask('task-2', ['task-1']),
          nodeId: 'downstream',
        },
      ],
    };

    await planExecutor.execute(plan);

    expect(downstream.receivedTasks).toHaveLength(1);

    const receivedTask = downstream.receivedTasks[0];

    expect(receivedTask.context.facts.dependencies).toEqual({
      'task-1': {
        taskId: 'task-1',
        success: true,
        output: {
          executedBy: 'upstream',
          requirements: ['test requirement'],
        },
        metadata: {
          nodeId: 'upstream',
        },
      },
    });
  });

  it('passes dependency results through task context', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new RecordingNode('recording-node');

    nodeRegistry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const taskExecutor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(taskExecutor);

    const planner = new Planner(nodeRegistry, selector);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'recording-node',
        },
        {
          task: {
            id: 'task-2',
            aspect: 'extract_requirements',
            input: {},
            context: {
              facts: {},
              constraints: [],
              assumptions: [],
              references: [],
            },
            outputSchema: {},
            dependencies: ['task-1'],
          },
          nodeId: 'recording-node',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(2);

    expect(node.receivedTasks[1].context.facts.dependencies).toEqual({
      'task-1': results[0],
    });
  });

  it('fails dependent tasks when a dependency fails', async () => {
    const nodeRegistry = new NodeRegistry();

    const failingNode = new RecordingNode('failing-node');
    const dependentNode = new RecordingNode('dependent-node');

    failingNode.execute = async (task) => {
      failingNode.receivedTasks.push(task);

      return {
        taskId: task.id,
        success: false,
        output: null,
        metadata: {
          nodeId: failingNode.id,
        },
        error: {
          code: 'TEST_FAILURE',
          message: 'Task failed',
        },
      };
    };

    nodeRegistry.register(failingNode);
    nodeRegistry.register(dependentNode);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const taskExecutor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(taskExecutor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'failing-node',
        },
        {
          task: {
            id: 'task-2',
            aspect: 'extract_requirements',
            input: {},
            context: {
              facts: {},
              constraints: [],
              assumptions: [],
              references: [],
            },
            outputSchema: {},
            dependencies: ['task-1'],
          },
          nodeId: 'dependent-node',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      taskId: 'task-1',
      success: false,
      error: {
        code: 'TEST_FAILURE',
        message: 'Task failed',
      },
    });

    expect(results[1]).toMatchObject({
      taskId: 'task-2',
      success: false,
      error: {
        code: 'DEPENDENCY_FAILED',
        message: 'A dependency failed',
      },
    });

    expect(failingNode.receivedTasks).toHaveLength(1);
    expect(dependentNode.receivedTasks).toHaveLength(0);
  });

  it('limits concurrent task execution', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new ConcurrencyNode('concurrency-node', 20);

    nodeRegistry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const taskExecutor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(taskExecutor, 2);

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

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: createTask('task-1'),
          nodeId: 'concurrency-node',
        },
        {
          task: createTask('task-2'),
          nodeId: 'concurrency-node',
        },
        {
          task: createTask('task-3'),
          nodeId: 'concurrency-node',
        },
        {
          task: createTask('task-4'),
          nodeId: 'concurrency-node',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(results).toHaveLength(4);

    expect(node.receivedTasks).toHaveLength(4);

    expect(node.maxActive).toBe(2);
  });

  it('rejects plans with cyclic dependencies', async () => {
    const nodeRegistry = new NodeRegistry();

    const node = new RecordingNode('node');

    nodeRegistry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const taskExecutor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(taskExecutor);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
            dependencies: ['task-2'],
          },
          nodeId: 'node',
        },
        {
          task: {
            id: 'task-2',
            aspect: 'extract_requirements',
            input: {},
            context: {
              facts: {},
              constraints: [],
              assumptions: [],
              references: [],
            },
            outputSchema: {},
            dependencies: ['task-1'],
          },
          nodeId: 'node',
        },
      ],
    };

    await expect(planExecutor.execute(plan)).rejects.toThrow(
      'Dependency cycle detected involving task: task-1',
    );

    expect(node.receivedTasks).toHaveLength(0);
  });
});
