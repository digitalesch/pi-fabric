import { describe, expect, it } from 'vitest';

import type { PhysicalPlan } from '../../src/core/physical-plan.js';
import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';

class FakeExecutor {
  public executed: string[] = [];

  async executeOn(task: Task, _nodeId: string): Promise<Result> {
    this.executed.push(task.id);

    return {
      taskId: task.id,
      success: true,
      output: task.id,
      metadata: {
        nodeId: 'test-node',
      },
    };
  }
}

function task(id: string, dependencies: string[] = []): Task {
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
  it('executes independent tasks', async () => {
    const executor = new FakeExecutor();

    const planExecutor = new PlanExecutor(executor as any);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: task('task-1'),
          nodeId: 'node-1',
        },
        {
          task: task('task-2'),
          nodeId: 'node-2',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(executor.executed).toHaveLength(2);

    expect(executor.executed.sort()).toEqual(['task-1', 'task-2']);
  });

  it('waits for dependencies', async () => {
    const executor = new FakeExecutor();

    const planExecutor = new PlanExecutor(executor as any);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: task('task-1'),
          nodeId: 'node-1',
        },
        {
          task: task('task-2', ['task-1']),
          nodeId: 'node-2',
        },
      ],
    };

    const results = await planExecutor.execute(plan);

    expect(executor.executed).toHaveLength(2);

    expect(executor.executed.sort()).toEqual(['task-1', 'task-2']);
  });
});
