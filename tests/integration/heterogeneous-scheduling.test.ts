import { describe, expect, it } from 'vitest';

import type { Capability } from '../../src/core/capability.js';
import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';
import type { ModelNode } from '../../src/nodes/node.js';

import { NodeEligibility } from '../../src/runtime/node-eligibility.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { Planner } from '../../src/runtime/planner.js';
import { NodeRegistry } from '../../src/runtime/registry.js';

class TestNode implements ModelNode {
  constructor(
    public readonly nodeId: string,
    private readonly nodeCapabilities: Capability[],
    private readonly shouldFail = false,
  ) {}

  capabilities(): Capability[] {
    return this.nodeCapabilities;
  }

  async execute(task: Task): Promise<Result> {
    if (this.shouldFail) {
      return {
        taskId: task.id,
        success: false,
        output: null,
        metadata: {
          nodeId: this.nodeId,
        },
        error: {
          code: 'TEST_FAILURE',
          message: `${this.nodeId} failed`,
        },
      };
    }

    return {
      taskId: task.id,
      success: true,
      output: {
        node: this.nodeId,
      },
      metadata: {
        nodeId: this.nodeId,
      },
    };
  }
}

function capability(overrides: Partial<Capability> = {}): Capability {
  return {
    aspect: 'extract_requirements',
    quality: 0.8,
    contextWindow: 4096,
    local: true,
    latencyMs: 100,
    ...overrides,
  };
}

function task(requirements?: Task['requirements']): Task {
  return {
    id: 'task-1',
    aspect: 'extract_requirements',
    input: {
      objective: 'Extract requirements for a CoreXY machine',
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
    requirements,
  };
}

describe('Heterogeneous node scheduling', () => {
  it('selects the highest-quality eligible node', () => {
    const lowQuality = new TestNode('cheap-node', [
      capability({ quality: 0.5 }),
    ]);

    const highQuality = new TestNode('quality-node', [
      capability({ quality: 0.95 }),
    ]);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const selected = selector.select(
      [lowQuality, highQuality],
      'extract_requirements',
    );

    expect(selected.nodeId).toBe('quality-node');
  });

  it('filters out nodes below the minimum quality', () => {
    const lowQuality = new TestNode('cheap-node', [
      capability({ quality: 0.5 }),
    ]);

    const highQuality = new TestNode('quality-node', [
      capability({ quality: 0.95 }),
    ]);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const selected = selector.select(
      [lowQuality, highQuality],
      'extract_requirements',
      {
        minimumQuality: 0.8,
      },
    );

    expect(selected.nodeId).toBe('quality-node');
  });

  it('rejects nodes above the maximum latency', () => {
    const slow = new TestNode('slow-node', [
      capability({ quality: 0.95, latencyMs: 500 }),
    ]);

    const fast = new TestNode('fast-node', [
      capability({ quality: 0.8, latencyMs: 20 }),
    ]);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const selected = selector.select([slow, fast], 'extract_requirements', {
      maximumLatencyMs: 100,
    });

    expect(selected.nodeId).toBe('fast-node');
  });

  it('combines quality and latency constraints', () => {
    const cheapFast = new TestNode('cheap-fast', [
      capability({
        quality: 0.6,
        latencyMs: 10,
      }),
    ]);

    const qualitySlow = new TestNode('quality-slow', [
      capability({
        quality: 0.95,
        latencyMs: 500,
      }),
    ]);

    const balanced = new TestNode('balanced', [
      capability({
        quality: 0.85,
        latencyMs: 50,
      }),
    ]);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const selected = selector.select(
      [cheapFast, qualitySlow, balanced],
      'extract_requirements',
      {
        minimumQuality: 0.8,
        maximumLatencyMs: 100,
      },
    );

    expect(selected.nodeId).toBe('balanced');
  });

  it('rejects local-only requirements for remote nodes', () => {
    const remote = new TestNode('remote-node', [
      capability({
        local: false,
        quality: 0.99,
      }),
    ]);

    const local = new TestNode('local-node', [
      capability({
        local: true,
        quality: 0.8,
      }),
    ]);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const selected = selector.select([remote, local], 'extract_requirements', {
      localOnly: true,
    });

    expect(selected.nodeId).toBe('local-node');
  });

  it('fails when no node satisfies the requirements', () => {
    const node = new TestNode('only-node', [
      capability({
        quality: 0.5,
        latencyMs: 500,
      }),
    ]);

    const selector = new NodeSelector(new QualityFirstPolicy());

    expect(() =>
      selector.select([node], 'extract_requirements', {
        minimumQuality: 0.9,
        maximumLatencyMs: 100,
      }),
    ).toThrow(
      'No node satisfies requirements for aspect: extract_requirements',
    );
  });

  it('planner assigns the selected node to the physical task', () => {
    const cheap = new TestNode('cheap-node', [capability({ quality: 0.5 })]);

    const quality = new TestNode('quality-node', [
      capability({ quality: 0.95 }),
    ]);

    const registry = new NodeRegistry();

    registry.register(cheap);
    registry.register(quality);

    const planner = new Planner(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const physicalPlan = planner.plan({
      tasks: [
        task({
          minimumQuality: 0.9,
        }),
      ],
    });

    expect(physicalPlan.tasks).toHaveLength(1);
    expect(physicalPlan.tasks[0].nodeId).toBe('quality-node');
  });

  it('uses the same scheduling rules through NodeEligibility', () => {
    const eligibility = new NodeEligibility();

    const node = new TestNode('needle', [
      capability({
        quality: 0.9,
        contextWindow: 8192,
        local: true,
        latencyMs: 50,
      }),
    ]);

    expect(
      eligibility.satisfies(node, 'extract_requirements', {
        minimumQuality: 0.8,
        minimumContextWindow: 4096,
        localOnly: true,
        maximumLatencyMs: 100,
      }),
    ).toBe(true);

    expect(
      eligibility.satisfies(node, 'extract_requirements', {
        minimumQuality: 0.95,
      }),
    ).toBe(false);
  });
});
