import { describe, expect, it } from 'vitest';

import { createFabric } from '../../src/create-fabric.js';
import type { Evaluator, Evaluation } from '../../src/evaluation/evaluator.js';

import type { Result } from '../../src/core/result.js';

import type { Thinker } from '../../src/thinker/thinker.js';
import type { Objective } from '../../src/core/objective.js';
import type { Plan } from '../../src/core/plan.js';
import { Task } from '../../src/core/task.js';
import { ModelNode } from '../../src/nodes/node.js';
import { Capability } from '../../src/core/capability.js';

import { Fabric } from '../../src/runtime/fabric.js';
import { AspectRegistry } from '../../src/runtime/aspect-registry.js';
import { Executor } from '../../src/runtime/executor.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';
import { Planner } from '../../src/runtime/planner.js';
import { PlanValidator } from '../../src/runtime/plan-validator.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';

import { InferenceNode } from '../../src/nodes/inference-node.js';
import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { InProcessTransport } from '../../src/transport/in-process.js';

import { extractRequirements } from '../../src/core/aspects/extract-requirements.js';

function createFabricForTest(
  thinker: Thinker,
  evaluator: Evaluator,
  node: ModelNode,
): Fabric {
  const aspectRegistry = new AspectRegistry();

  aspectRegistry.register(extractRequirements);

  const provider = new FakeInferenceProvider();

  const transport = new InProcessTransport(provider);

  const nodeRegistry = new NodeRegistry();

  nodeRegistry.register(node);

  const selector = new NodeSelector(new QualityFirstPolicy());

  const executor = new Executor(nodeRegistry, selector);

  const planExecutor = new PlanExecutor(executor);

  const planner = new Planner(nodeRegistry, selector);

  const planValidator = new PlanValidator();

  return new Fabric(
    thinker,
    planner,
    planExecutor,
    aspectRegistry,
    planValidator,
    evaluator,
  );
}

// class RecordingNode implements ModelNode {
//   public receivedTasks: Task[] = [];

//   constructor(
//     public readonly id: string,
//   ) {}

//   capabilities(): Capability[] {
//     return [
//       {
//         aspect: "extract_requirements",
//         quality: 0.9,
//         contextWindow: 8192,
//         local: true,
//       },
//     ];
//   }

//   async execute(task: Task): Promise<Result> {
//     this.receivedTasks.push(task);

//     return {
//       taskId: task.id,
//       success: true,
//       output: {
//         executedBy: this.id,
//       },
//       metadata: {
//         nodeId: this.id,
//       },
//     };
//   }
// }

class ControllableEvaluator implements Evaluator {
  public calls = 0;
  public evaluatedTaskIds: string[] = [];

  constructor(private readonly evaluations: Evaluation[]) {}

  async evaluate(result: Result): Promise<Evaluation> {
    this.evaluatedTaskIds.push(result.taskId);

    const evaluation =
      this.evaluations[Math.min(this.calls, this.evaluations.length - 1)];

    this.calls++;

    return evaluation;
  }
}
class ReplanningThinker implements Thinker {
  public planCalls = 0;
  public replanCalls = 0;
  public synthesizeCalls = 0;
  public replanningEvaluations: Evaluation[][] = [];

  async plan(_objective: Objective): Promise<Plan> {
    this.planCalls++;

    return {
      tasks: [
        {
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
      ],
    };
  }

  async evaluate(
    _objective: Objective,
    _results: Result[],
    _evaluations: Evaluation[],
  ): Promise<unknown> {
    return undefined;
  }

  async replan(
    _objective: Objective,
    previousPlan: Plan,
    _results: Result[],
    evaluations: Evaluation[],
  ): Promise<Plan> {
    this.replanCalls++;

    this.replanningEvaluations.push(evaluations);

    return {
      ...previousPlan,
      tasks: previousPlan.tasks.map((task) => ({
        ...task,
        id: `replanned-${task.id}`,
        context: {
          ...task.context,
          facts: {
            ...task.context.facts,
            evaluation: evaluations,
          },
        },
      })),
    };
  }

  async synthesize(_objective: Objective, _results: Result[]): Promise<string> {
    this.synthesizeCalls++;

    return 'final answer';
  }
}

class RecordingNode implements ModelNode {
  public receivedTasks: Task[] = [];

  constructor(public readonly id: string) {}

  capabilities(): Capability[] {
    return [
      {
        aspect: 'extract_requirements',
        quality: 0.8,
        contextWindow: 8192,
        local: true,
      },
    ];
  }

  async execute(task: Task): Promise<Result> {
    this.receivedTasks.push(task);

    return {
      taskId: task.id,
      success: true,
      output: {
        requirements: ['test requirement'],
      },
      metadata: {
        nodeId: this.id,
      },
    };
  }
}

describe('Fabric', () => {
  it('plans and executes an objective', async () => {
    const fabric = createFabric();

    const result = await fabric.run({
      description: 'Analyze a mechanical design and identify its requirements.',
    });

    expect(result).toContain('extract_requirements');
  });

  it('replans when evaluation rejects results', async () => {
    const thinker = new ReplanningThinker();

    const evaluator = new ControllableEvaluator([
      {
        taskId: 'task-1',
        accepted: false,
        issues: ['bad output'],
      },
      {
        taskId: 'replanned-task-1',
        accepted: true,
        issues: [],
      },
    ]);

    const node = new RecordingNode('recording-node');

    const fabric = createFabricForTest(thinker, evaluator, node);

    const result = await fabric.run({
      description: 'test objective',
    });

    expect(result).toBe('final answer');

    expect(evaluator.calls).toBe(2);
    expect(thinker.planCalls).toBe(1);
    expect(thinker.replanCalls).toBe(1);
    expect(thinker.synthesizeCalls).toBe(1);
    expect(evaluator.evaluatedTaskIds).toEqual(['task-1', 'replanned-task-1']);

    expect(thinker.replanningEvaluations).toHaveLength(1);

    expect(thinker.replanningEvaluations[0][0]).toEqual({
      taskId: 'task-1',
      accepted: false,
      issues: ['bad output'],
    });

    expect(thinker.replanningEvaluations).toHaveLength(1);

    expect(thinker.replanningEvaluations[0]).toEqual([
      {
        taskId: 'task-1',
        accepted: false,
        issues: ['bad output'],
      },
    ]);

    expect(node.receivedTasks).toHaveLength(2);

    expect(node.receivedTasks[0].context.facts.evaluation).toBeUndefined();

    expect(node.receivedTasks[1].context.facts.evaluation).toEqual([
      {
        taskId: 'task-1',
        accepted: false,
        issues: ['bad output'],
      },
    ]);
  });

  it('does not replan when all evaluations are accepted', async () => {
    const thinker = new ReplanningThinker();

    const evaluator = new ControllableEvaluator([
      {
        taskId: 'task-1',
        accepted: true,
        issues: [],
      },
    ]);

    const node = new RecordingNode('recording-node');

    const fabric = createFabricForTest(thinker, evaluator, node);

    const result = await fabric.run({
      description: 'test objective',
    });

    expect(result).toBe('final answer');

    expect(thinker.planCalls).toBe(1);
    expect(thinker.replanCalls).toBe(0);
    expect(thinker.synthesizeCalls).toBe(1);

    expect(evaluator.calls).toBe(1);

    expect(node.receivedTasks).toHaveLength(1);
    expect(node.receivedTasks[0].id).toBe('task-1');
  });

  it('passes evaluations to the thinker when replanning', async () => {
    const thinker = new ReplanningThinker();

    const evaluator = new ControllableEvaluator([
      {
        taskId: 'task-1',
        accepted: false,
        issues: ['bad output'],
      },
      {
        taskId: 'replanned-task-1',
        accepted: true,
        issues: [],
      },
    ]);

    const node = new RecordingNode('test-node');

    const fabric = createFabricForTest(thinker, evaluator, node);

    await fabric.run({
      description: 'test objective',
    });

    expect(thinker.replanCalls).toBe(1);

    expect(evaluator.evaluatedTaskIds).toEqual(['task-1', 'replanned-task-1']);

    expect(node.receivedTasks).toHaveLength(2);

    expect(node.receivedTasks[0].id).toBe('task-1');

    expect(node.receivedTasks[1].id).toBe('replanned-task-1');
  });
});
