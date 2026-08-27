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

class RecordingNode implements ModelNode {
  public receivedTasks: Task[] = [];

  constructor(public readonly id: string) {}

  capabilities(): Capability[] {
    return [];
  }

  async execute(task: Task): Promise<Result> {
    this.receivedTasks.push(task);

    return {
      taskId: task.id,
      success: true,
      output: task.id,
      metadata: {
        nodeId: this.id,
      },
    };
  }
}

class DelayedNode implements ModelNode {
  public active = 0;
  public maxActive = 0;

  constructor(
    public readonly id: string,
    private readonly delayMs: number,
    private readonly events: string[],
  ) {}

  capabilities(): Capability[] {
    return [];
  }

  async execute(task: Task): Promise<Result> {
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);

    this.events.push(`${task.id}:start`);

    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    this.events.push(`${task.id}:end`);

    this.active--;

    return {
      taskId: task.id,
      success: true,
      output: task.id,
      metadata: {
        nodeId: this.id,
      },
    };
  }
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

describe('PlanExecutor', () => {
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
        output: 'task-1',
        metadata: {
          nodeId: 'upstream',
        },
      },
    });
  });
});
