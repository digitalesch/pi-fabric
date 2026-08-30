import { describe, expect, it } from 'vitest';

import { createFabric } from '../../src/create-fabric.js';
import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { PerformanceRegistry } from '../../src/runtime/performance-registry.js';

import type { Evaluator, Evaluation } from '../../src/evaluation/evaluator.js';
import type { EvaluationDecision } from '../../src/core/evaluation-decision.js';
import type { Result } from '../../src/core/result.js';
import type { Thinker } from '../../src/thinker/thinker.js';
import type { Objective } from '../../src/core/objective.js';
import type { Plan } from '../../src/core/plan.js';
import type { ModelNode } from '../../src/nodes/node.js';

import { Fabric } from '../../src/runtime/fabric.js';
import { AspectRegistry } from '../../src/runtime/aspect-registry.js';
import { Executor } from '../../src/runtime/executor.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';
import { Planner } from '../../src/runtime/planner.js';
import { PlanValidator } from '../../src/runtime/plan-validator.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';

import { extractRequirements } from '../../src/core/aspects/extract-requirements.js';
import { RecordingNode } from '../helpers/recording-node.js';

function createFabricForTest(
  thinker: Thinker,
  evaluator: Evaluator,
  nodes: ModelNode[],
): Fabric {
  const aspectRegistry = new AspectRegistry();

  aspectRegistry.register(extractRequirements);

  const nodeRegistry = new NodeRegistry();

  for (const node of nodes) {
    nodeRegistry.register(node);
  }

  const selector = new NodeSelector(new QualityFirstPolicy());

  const executor = new Executor(nodeRegistry, selector);

  const planExecutor = new PlanExecutor(executor);

  const planner = new Planner(nodeRegistry, selector);

  const planValidator = new PlanValidator();

  const performanceRegistry = new PerformanceRegistry();
  const provider = new FakeInferenceProvider();
const inferenceProviders = [provider];

return new Fabric(
  thinker,
  planner,
  planExecutor,
  aspectRegistry,
  planValidator,
  evaluator,
  3,
  inferenceProviders,
  performanceRegistry,
);
}

class InvalidDependencyThinker implements Thinker {
  public planCalls = 0;
  public replanCalls = 0;
  public synthesizeCalls = 0;

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
        {
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
      ],
    };
  }

  async evaluate(
    _objective: Objective,
    _results: Result[],
    evaluations: Evaluation[],
  ): Promise<EvaluationDecision> {
    return {
      accepted: evaluations.every((evaluation) => evaluation.accepted),
      issues: evaluations.flatMap((evaluation) => evaluation.issues),
    };
  }

  async replan(
    _objective: Objective,
    previousPlan: Plan,
    _results: Result[],
    _evaluations: Evaluation[],
  ): Promise<Plan> {
    this.replanCalls++;

    return {
      ...previousPlan,
      tasks: previousPlan.tasks.map((task) => ({
        ...task,
        id: `replanned-${task.id}`,
      })),
    };
  }

  async synthesize(_objective: Objective, _results: Result[]): Promise<string> {
    this.synthesizeCalls++;

    return 'final answer';
  }
}

class MultiTaskThinker implements Thinker {
  public planCalls = 0;
  public replanCalls = 0;
  public synthesizeCalls = 0;

  public replanningEvaluations: Evaluation[][] = [];
  public replanningResults: Result[][] = [];

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
        {
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
        {
          id: 'task-3',
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
    evaluations: Evaluation[],
  ): Promise<EvaluationDecision> {
    return {
      accepted: evaluations.every((evaluation) => evaluation.accepted),
      issues: evaluations.flatMap((evaluation) => evaluation.issues),
    };
  }

  async replan(
    _objective: Objective,
    previousPlan: Plan,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<Plan> {
    this.replanCalls++;

    this.replanningResults.push(results);
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
            previousEvaluation: evaluations.find(
              (evaluation) => evaluation.taskId === task.id,
            ),
            previousResult: results.find((result) => result.taskId === task.id),
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
    evaluations: Evaluation[],
  ): Promise<EvaluationDecision> {
    return {
      accepted: evaluations.every((evaluation) => evaluation.accepted),
      issues: evaluations.flatMap((evaluation) => evaluation.issues),
    };
  }

  async replan(
    _objective: Objective,
    previousPlan: Plan,
    _results: Result[],
    evaluations: Evaluation[],
  ): Promise<Plan> {
    this.replanCalls++;

    this.replanningEvaluations.push(evaluations);

    const idMap = new Map(
      previousPlan.tasks.map((task) => [task.id, `replanned-${task.id}`]),
    );

    return {
      ...previousPlan,
      tasks: previousPlan.tasks.map((task, index) => {
        const evaluation = evaluations[index];

        return {
          ...task,
          id: idMap.get(task.id)!,
          dependencies: task.dependencies.map(
            (dependency) => idMap.get(dependency) ?? dependency,
          ),
          context: {
            ...task.context,
            facts: {
              ...task.context.facts,
              previousEvaluation: evaluation,
            },
            constraints: [
              ...task.context.constraints,
              ...(evaluation.feedback?.missing ?? []).map(
                (missing) => `Ensure the output includes: ${missing}`,
              ),
            ],
          },
        };
      }),
    };
  }

  async synthesize(_objective: Objective, _results: Result[]): Promise<string> {
    this.synthesizeCalls++;

    return 'final answer';
  }
}

describe('Fabric', () => {
  it('closes configured providers', async () => {
    const provider = new FakeInferenceProvider();

    const fabric = createFabric({
      providers: [provider],
    });

    expect(provider.closed).toBe(false);

    await fabric.close();

    expect(provider.closed).toBe(true);
  });

  it('replans with stronger requirements after evaluation failure', async () => {
    const lowQualityNode = new RecordingNode('low-quality', {
      aspect: 'extract_requirements',
      quality: 0.8,
      contextWindow: 8192,
      latencyMs: 50,
      local: true,
    });

    const highQualityNode = new RecordingNode('high-quality', {
      aspect: 'extract_requirements',
      quality: 0.95,
      contextWindow: 16384,
      latencyMs: 100,
      local: true,
    });

    let replanCount = 0;
    let evaluationCount = 0;

    const thinker: Thinker = {
      async plan(objective) {
        return {
          tasks: [
            {
              id: 'task-1',
              aspect: 'extract_requirements',
              input: {
                objective: objective.description,
              },
              context: {
                facts: {},
                constraints: [],
                assumptions: [],
                references: [],
              },
              outputSchema: {
                requirements: 'string[]',
              },
              dependencies: [],
              requirements: {
                maximumLatencyMs: 50,
              },
            },
          ],
        };
      },

      async evaluate(_objective, _results, _evaluations) {
        return {
          accepted: evaluationCount >= 2,
          issues:
            evaluationCount >= 2 ? [] : ['Output quality was insufficient'],
        };
      },

      async replan(_objective, previousPlan, _results, _evaluations) {
        replanCount++;

        return {
          ...previousPlan,
          tasks: previousPlan.tasks.map((task) => ({
            ...task,
            id: `replanned-${task.id}`,
            requirements: {
              minimumQuality: 0.95,
              minimumContextWindow: 8192,
              localOnly: true,
            },
          })),
        };
      },

      async synthesize(_objective, results) {
        return JSON.stringify(results);
      },
    };

    const evaluator: Evaluator = {
      async evaluate(result: Result) {
        evaluationCount++;

        if (evaluationCount === 1) {
          return {
            taskId: result.taskId,
            accepted: false,
            issues: ['Output quality was insufficient'],
          };
        }

        return {
          taskId: result.taskId,
          accepted: true,
          issues: [],
        };
      },
    };

    const fabric = createFabricForTest(thinker, evaluator, [
      lowQualityNode,
      highQualityNode,
    ]);

    const result = await fabric.run({
      description: 'test objective',
    });

    expect(result).toBeDefined();

    expect(replanCount).toBe(1);

    expect(lowQualityNode.receivedTasks).toHaveLength(1);
    expect(highQualityNode.receivedTasks).toHaveLength(1);

    expect(lowQualityNode.receivedTasks[0].requirements?.maximumLatencyMs).toBe(
      50,
    );

    expect(highQualityNode.receivedTasks[0].requirements?.minimumQuality).toBe(
      0.95,
    );

    expect(
      highQualityNode.receivedTasks[0].requirements?.minimumContextWindow,
    ).toBe(8192);
  });

  it('uses task requirements when selecting an execution node', async () => {
    const smallNode = new RecordingNode('small-node', {
      aspect: 'extract_requirements',
      quality: 0.7,
      contextWindow: 4096,
      latencyMs: 50,
      local: true,
    });

    const largeNode = new RecordingNode('large-node', {
      aspect: 'extract_requirements',
      quality: 0.95,
      contextWindow: 16384,
      latencyMs: 100,
      local: true,
    });

    const thinker: Thinker = {
      async plan(objective) {
        return {
          tasks: [
            {
              id: 'extract-requirements',
              aspect: 'extract_requirements',
              input: {
                objective: objective.description,
              },
              context: {
                facts: {},
                constraints: [],
                assumptions: [],
                references: [],
              },
              outputSchema: {
                requirements: 'string[]',
              },
              dependencies: [],
              requirements: {
                minimumQuality: 0.9,
                minimumContextWindow: 8192,
                localOnly: true,
              },
            },
          ],
        };
      },

      async evaluate() {
        return {
          accepted: true,
          issues: [],
        };
      },

      async replan(_objective, previousPlan) {
        return previousPlan;
      },

      async synthesize() {
        return 'done';
      },
    };

    const evaluator: Evaluator = {
      async evaluate(result: Result) {
        return { taskId: result.taskId, accepted: true, issues: [] };
      },
    };

    const fabric = createFabricForTest(thinker, evaluator, [
      smallNode,
      largeNode,
    ]);

    await fabric.run({
      description: 'test objective',
    });

    expect(smallNode.receivedTasks).toHaveLength(0);
    expect(largeNode.receivedTasks).toHaveLength(1);
  });

  it('replans when one task fails evaluation', async () => {
    const thinker = new MultiTaskThinker();

    const evaluator = new ControllableEvaluator([
      {
        taskId: 'task-1',
        accepted: false,
        issues: ['bad output'],
        feedback: {
          missing: ['requirements'],
          confidence: 0.42,
        },
      },
      {
        taskId: 'task-2',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'task-3',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'replanned-task-1',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'replanned-task-2',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'replanned-task-3',
        accepted: true,
        issues: [],
      },
    ]);

    const node = new RecordingNode('test-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

    const result = await fabric.run({
      description: 'test objective',
    });

    expect(result).toBe('final answer');

    expect(thinker.planCalls).toBe(1);

    expect(thinker.replanCalls).toBe(1);

    expect(thinker.synthesizeCalls).toBe(1);

    expect(evaluator.evaluatedTaskIds).toHaveLength(6);

    expect(evaluator.evaluatedTaskIds).toEqual(
      expect.arrayContaining([
        'task-1',
        'task-2',
        'task-3',
        'replanned-task-1',
        'replanned-task-2',
        'replanned-task-3',
      ]),
    );

    expect(thinker.replanningResults).toHaveLength(1);

    expect(thinker.replanningResults[0]).toHaveLength(3);

    expect(thinker.replanningResults[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'task-1',
        }),
        expect.objectContaining({
          taskId: 'task-2',
        }),
        expect.objectContaining({
          taskId: 'task-3',
        }),
      ]),
    );
  });

  it('stops after the maximum number of attempts', async () => {
    const thinker = new ReplanningThinker();

    const evaluator = new ControllableEvaluator([
      {
        taskId: 'task-1',
        accepted: false,
        issues: ['bad output'],
        feedback: {
          missing: ['requirements'],
          confidence: 0.42,
        },
      },
    ]);

    const node = new RecordingNode('test-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

    await expect(
      fabric.run({
        description: 'test objective',
      }),
    ).rejects.toThrow('Maximum execution attempts exceeded: 3');

    expect(thinker.planCalls).toBe(1);

    expect(thinker.replanCalls).toBe(2);

    expect(thinker.synthesizeCalls).toBe(0);

    expect(evaluator.calls).toBe(3);

    expect(node.receivedTasks).toHaveLength(3);
  });

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
        feedback: {
          missing: ['requirements'],
          confidence: 0.42,
        },
      },
      {
        taskId: 'replanned-task-1',
        accepted: true,
        issues: [],
      },
    ]);

    const node = new RecordingNode('recording-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

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

    expect(thinker.replanningEvaluations[0]).toEqual([
      {
        taskId: 'task-1',
        accepted: false,
        issues: ['bad output'],
        feedback: {
          missing: ['requirements'],
          confidence: 0.42,
        },
      },
    ]);

    expect(node.receivedTasks).toHaveLength(2);

    expect(
      node.receivedTasks[0].context.facts.previousEvaluation,
    ).toBeUndefined();

    expect(node.receivedTasks[1].context.facts.previousEvaluation).toEqual({
      taskId: 'task-1',
      accepted: false,
      issues: ['bad output'],
      feedback: {
        missing: ['requirements'],
        confidence: 0.42,
      },
    });
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

    const fabric = createFabricForTest(thinker, evaluator, [node]);

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
        feedback: {
          missing: ['requirements'],
          confidence: 0.42,
        },
      },
      {
        taskId: 'replanned-task-1',
        accepted: true,
        issues: [],
      },
    ]);

    const node = new RecordingNode('test-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

    await fabric.run({
      description: 'test objective',
    });

    expect(thinker.replanCalls).toBe(1);

    expect(thinker.replanningEvaluations).toEqual([
      [
        {
          taskId: 'task-1',
          accepted: false,
          issues: ['bad output'],
          feedback: {
            missing: ['requirements'],
            confidence: 0.42,
          },
        },
      ],
    ]);

    expect(evaluator.evaluatedTaskIds).toEqual(['task-1', 'replanned-task-1']);

    expect(node.receivedTasks).toHaveLength(2);

    expect(node.receivedTasks[0].id).toBe('task-1');

    expect(node.receivedTasks[1].id).toBe('replanned-task-1');

    expect(node.receivedTasks[1].context.facts.previousEvaluation).toEqual({
      taskId: 'task-1',
      accepted: false,
      issues: ['bad output'],
      feedback: {
        missing: ['requirements'],
        confidence: 0.42,
      },
    });
  });

  it('replans when one task fails evaluation', async () => {
    const thinker = new MultiTaskThinker();

    const evaluator = new ControllableEvaluator([
      {
        taskId: 'task-1',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'task-2',
        accepted: false,
        issues: ['bad output'],
        feedback: {
          missing: ['requirements'],
          confidence: 0.42,
        },
      },
      {
        taskId: 'task-3',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'replanned-task-1',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'replanned-task-2',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'replanned-task-3',
        accepted: true,
        issues: [],
      },
    ]);

    const node = new RecordingNode('recording-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

    const result = await fabric.run({
      description: 'test objective',
    });

    expect(result).toBe('final answer');

    expect(thinker.planCalls).toBe(1);

    expect(thinker.replanCalls).toBe(1);

    expect(thinker.synthesizeCalls).toBe(1);

    expect(evaluator.evaluatedTaskIds).toEqual([
      'task-1',
      'task-2',
      'task-3',
      'replanned-task-1',
      'replanned-task-2',
      'replanned-task-3',
    ]);

    expect(thinker.replanningEvaluations).toEqual([
      [
        {
          taskId: 'task-1',
          accepted: true,
          issues: [],
        },
        {
          taskId: 'task-2',
          accepted: false,
          issues: ['bad output'],
          feedback: {
            missing: ['requirements'],
            confidence: 0.42,
          },
        },
        {
          taskId: 'task-3',
          accepted: true,
          issues: [],
        },
      ],
    ]);

    expect(thinker.replanningResults[0]).toHaveLength(3);

    expect(thinker.replanningResults[0].map((result) => result.taskId)).toEqual(
      ['task-1', 'task-2', 'task-3'],
    );

    expect(node.receivedTasks).toHaveLength(6);
  });

  it('rejects a replanned plan with missing dependencies', async () => {
    class InvalidReplanningThinker extends MultiTaskThinker {
      override async replan(
        _objective: Objective,
        previousPlan: Plan,
        _results: Result[],
        _evaluations: Evaluation[],
      ): Promise<Plan> {
        this.replanCalls++;

        return {
          ...previousPlan,
          tasks: previousPlan.tasks.map((task) => ({
            ...task,
            id: `replanned-${task.id}`,
            dependencies:
              task.dependencies.length > 0
                ? task.dependencies
                : task.id === 'task-2'
                  ? ['task-1']
                  : [],
          })),
        };
      }
    }

    const thinker = new InvalidReplanningThinker();

    const evaluator = new ControllableEvaluator([
      {
        taskId: 'task-1',
        accepted: true,
        issues: [],
      },
      {
        taskId: 'task-2',
        accepted: false,
        issues: ['bad output'],
      },
    ]);

    const node = new RecordingNode('recording-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

    await expect(
      fabric.run({
        description: 'test objective',
      }),
    ).rejects.toThrow('depends on missing task: task-1');

    expect(thinker.planCalls).toBe(1);
    expect(thinker.replanCalls).toBe(1);
    expect(thinker.synthesizeCalls).toBe(0);
  });

  it('propagates planning failures', async () => {
    class FailingPlannerThinker extends ReplanningThinker {
      override async plan(_objective: Objective): Promise<Plan> {
        this.planCalls++;

        throw new Error('planning failed');
      }
    }

    const thinker = new FailingPlannerThinker();

    const evaluator = new ControllableEvaluator([]);

    const node = new RecordingNode('recording-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

    await expect(
      fabric.run({
        description: 'test objective',
      }),
    ).rejects.toThrow('planning failed');

    expect(thinker.planCalls).toBe(1);

    expect(node.receivedTasks).toHaveLength(0);

    expect(evaluator.calls).toBe(0);
  });

  it('propagates evaluation failures', async () => {
    class FailingEvaluator implements Evaluator {
      public calls = 0;

      async evaluate(_result: Result): Promise<Evaluation> {
        this.calls++;

        throw new Error('evaluation failed');
      }
    }

    const thinker = new ReplanningThinker();

    const evaluator = new FailingEvaluator();

    const node = new RecordingNode('recording-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

    await expect(
      fabric.run({
        description: 'test objective',
      }),
    ).rejects.toThrow('evaluation failed');

    expect(thinker.planCalls).toBe(1);

    expect(thinker.replanCalls).toBe(0);

    expect(thinker.synthesizeCalls).toBe(0);

    expect(evaluator.calls).toBe(1);

    expect(node.receivedTasks).toHaveLength(1);
  });

  it('propagates synthesis failures', async () => {
    class FailingSynthesisThinker extends ReplanningThinker {
      override async synthesize(
        _objective: Objective,
        _results: Result[],
      ): Promise<string> {
        this.synthesizeCalls++;

        throw new Error('synthesis failed');
      }
    }

    const thinker = new FailingSynthesisThinker();

    const evaluator = new ControllableEvaluator([
      {
        taskId: 'task-1',
        accepted: true,
        issues: [],
      },
    ]);

    const node = new RecordingNode('recording-node');

    const fabric = createFabricForTest(thinker, evaluator, [node]);

    await expect(
      fabric.run({
        description: 'test objective',
      }),
    ).rejects.toThrow('synthesis failed');

    expect(thinker.planCalls).toBe(1);

    expect(thinker.replanCalls).toBe(0);

    expect(thinker.synthesizeCalls).toBe(1);

    expect(evaluator.calls).toBe(1);

    expect(node.receivedTasks).toHaveLength(1);
  });
});
