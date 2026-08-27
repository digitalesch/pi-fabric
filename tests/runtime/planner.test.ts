import { describe, expect, it } from 'vitest';

import { LocalNode } from '../../src/nodes/local.js';
import type { ModelNode } from '../../src/nodes/node.js';

import { NodeSelector } from '../../src/runtime/node-selector.js';
import { Planner } from '../../src/runtime/planner.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { NodeRegistry } from '../../src/runtime/registry.js';

import { FakeInferenceProvider } from '../../src/inference/fake.js';

import type { Capability } from '../../src/core/capability.js';
import { Task } from '../../src/core/task.js';
import { Result } from '../../src/core/result.js';

class RecordingNode implements ModelNode {
  public readonly receivedTasks: Task[] = [];

  constructor(
    public readonly id: string,
    private readonly capability: Capability,
  ) {}

  capabilities(): Capability[] {
    return [this.capability];
  }

  async execute(task: Task): Promise<Result> {
    this.receivedTasks.push(task);

    return {
      taskId: task.id,
      success: true,
      output: {
        requirements: ['test requirement'],
        executedBy: this.id,
      },
      metadata: {
        nodeId: this.id,
      },
    };
  }
}

describe('Planner', () => {
  it('assigns a logical task to the best capable node', () => {
    const registry = new NodeRegistry();
    const provider = new FakeInferenceProvider();

    const small = new LocalNode(
      'small-model',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.7,
          contextWindow: 4096,
          latencyMs: 50,
          local: true,
        },
      ],
      provider,
    );

    const large = new LocalNode(
      'large-model',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.95,
          contextWindow: 16384,
          latencyMs: 200,
          local: true,
        },
      ],
      provider,
    );

    registry.register(small);
    registry.register(large);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const planner = new Planner(registry, selector);

    const plan = planner.plan({
      tasks: [
        {
          id: 'task-1',
          aspect: 'extract_requirements',
          input: {
            document: 'mechanical design',
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
        },
      ],
    });

    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].task.id).toBe('task-1');
    expect(plan.tasks[0].nodeId).toBe('large-model');
  });

  it('uses task requirements when assigning a node', () => {
    const provider = new FakeInferenceProvider();
    const registry = new NodeRegistry();

    const localSmall = new LocalNode(
      'local-small',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.75,
          contextWindow: 4096,
          latencyMs: 30,
          local: true,
        },
      ],
      provider,
    );

    const localLarge = new LocalNode(
      'local-large',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.85,
          contextWindow: 16384,
          latencyMs: 100,
          local: true,
        },
      ],
      provider,
    );

    registry.register(localSmall);
    registry.register(localLarge);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const planner = new Planner(registry, selector);

    const plan = planner.plan({
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
          requirements: {
            minimumQuality: 0.8,
            minimumContextWindow: 8192,
            localOnly: true,
          },
        },
      ],
    });

    expect(plan.tasks[0].nodeId).toBe('local-large');
  });

  it('selects a node that satisfies task requirements', () => {
    const nodeRegistry = new NodeRegistry();

    const lowQualityNode = new RecordingNode('low-quality', {
      aspect: 'extract_requirements',
      quality: 0.6,
      contextWindow: 8192,
      local: true,
    });

    const highQualityNode = new RecordingNode('high-quality', {
      aspect: 'extract_requirements',
      quality: 0.9,
      contextWindow: 8192,
      local: true,
    });

    nodeRegistry.register(lowQualityNode);
    nodeRegistry.register(highQualityNode);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const planner = new Planner(nodeRegistry, selector);

    const plan = {
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
          requirements: {
            minimumQuality: 0.8,
          },
        },
      ],
    };

    const physicalPlan = planner.plan(plan);

    expect(physicalPlan.tasks[0].nodeId).toBe('high-quality');
  });

  it('rejects a task when no node satisfies its requirements', () => {
    const registry = new NodeRegistry();

    const node = new LocalNode(
      'small-model',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.7,
          contextWindow: 4096,
          latencyMs: 50,
          local: true,
        },
      ],
      new FakeInferenceProvider(),
    );

    registry.register(node);

    const planner = new Planner(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    expect(() =>
      planner.plan({
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
            requirements: {
              minimumQuality: 0.9,
            },
          },
        ],
      }),
    ).toThrow(
      'No node satisfies requirements for aspect: extract_requirements',
    );
  });

  it('does not select a higher-quality node that violates requirements', () => {
    const registry = new NodeRegistry();
    const provider = new FakeInferenceProvider();

    const highQualityShortContext = new LocalNode(
      'high-quality-short-context',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.95,
          contextWindow: 4096,
          latencyMs: 50,
          local: true,
        },
      ],
      provider,
    );

    const lowerQualityLargeContext = new LocalNode(
      'lower-quality-large-context',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.85,
          contextWindow: 16384,
          latencyMs: 100,
          local: true,
        },
      ],
      provider,
    );

    registry.register(highQualityShortContext);
    registry.register(lowerQualityLargeContext);

    const planner = new Planner(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const plan = planner.plan({
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
          requirements: {
            minimumContextWindow: 8192,
          },
        },
      ],
    });

    expect(plan.tasks[0].nodeId).toBe('lower-quality-large-context');
  });

  it('respects local-only and maximum-latency requirements', () => {
    const registry = new NodeRegistry();
    const provider = new FakeInferenceProvider();
    const remoteFastHighQuality = new LocalNode(
      'remote-fast-high-quality',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.95,
          contextWindow: 16384,
          latencyMs: 20,
          local: false,
        },
      ],
      provider,
    );
    const localSlowerLowerQuality = new LocalNode(
      'local-slower-lower-quality',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.8,
          contextWindow: 8192,
          latencyMs: 100,
          local: true,
        },
      ],
      provider,
    );
    registry.register(remoteFastHighQuality);
    registry.register(localSlowerLowerQuality);
    const planner = new Planner(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );
    const plan = planner.plan({
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
          requirements: { localOnly: true, maximumLatencyMs: 150 },
        },
      ],
    });
    expect(plan.tasks[0].nodeId).toBe('local-slower-lower-quality');
  });
});
