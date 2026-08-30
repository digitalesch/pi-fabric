import { describe, expect, it, vi } from 'vitest';

import type { Capability } from '../../src/core/capability.js';
import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';

import type { ModelNode } from '../../src/nodes/node.js';
import type { NodeHealth } from '../../src/nodes/node-health.js';

import { LoadAwarePolicy } from '../../src/scheduling/load-aware-policy.js';

import type {
  NodeScore,
  NodeScoreContext,
  NodeScorer,
} from '../../src/scheduling/node-scorer.js';

class TestNode implements ModelNode {
  constructor(
    public readonly nodeId: string,
    private readonly quality = 1,
    private readonly nodeHealth?: NodeHealth,
  ) {}

  capabilities(): Capability[] {
    return [
      {
        aspect: 'extract_requirements',
        quality: this.quality,
        contextWindow: 8192,
        local: true,
      },
    ];
  }

  health(): NodeHealth | undefined {
    return this.nodeHealth;
  }

  async execute(task: Task): Promise<Result> {
    return {
      taskId: task.id,
      success: true,
      output: {},
      metadata: {
        nodeId: this.nodeId,
      },
    };
  }
}

describe('LoadAwarePolicy', () => {
  it('selects the highest-scoring node', () => {
    const policy = new LoadAwarePolicy();

    const low = new TestNode('low', 0.2, {
      status: 'healthy',
      load: 0,
    });

    const high = new TestNode('high', 1, {
      status: 'healthy',
      load: 0,
    });

    expect(policy.select([low, high], 'extract_requirements')).toBe(high);
  });

  it('prefers lower load when quality is equal', () => {
    const policy = new LoadAwarePolicy();

    const idle = new TestNode('idle', 1, {
      status: 'healthy',
      load: 0,
    });

    const busy = new TestNode('busy', 1, {
      status: 'healthy',
      load: 1,
    });

    expect(policy.select([busy, idle], 'extract_requirements')).toBe(idle);
  });

  it('prefers healthy nodes', () => {
    const policy = new LoadAwarePolicy();

    const degraded = new TestNode('degraded', 1, {
      status: 'degraded',
      load: 0,
    });

    const healthy = new TestNode('healthy', 1, {
      status: 'healthy',
      load: 0,
    });

    expect(policy.select([degraded, healthy], 'extract_requirements')).toBe(
      healthy,
    );
  });

  it('ignores unavailable nodes', () => {
    const policy = new LoadAwarePolicy();

    const unavailable = new TestNode('unavailable', 1, {
      status: 'unavailable',
    });

    const healthy = new TestNode('healthy', 0.5, {
      status: 'healthy',
    });

    expect(policy.select([unavailable, healthy], 'extract_requirements')).toBe(
      healthy,
    );
  });

  it('allows degraded nodes when no healthy node exists', () => {
    const policy = new LoadAwarePolicy();

    const degraded = new TestNode('degraded', 1, {
      status: 'degraded',
    });

    expect(policy.select([degraded], 'extract_requirements')).toBe(degraded);
  });

  it('rejects candidates when every node is unavailable', () => {
    const policy = new LoadAwarePolicy();

    const first = new TestNode('first', 1, {
      status: 'unavailable',
    });

    const second = new TestNode('second', 1, {
      status: 'unavailable',
    });

    expect(() =>
      policy.select([first, second], 'extract_requirements'),
    ).toThrow('No healthy node available for aspect: extract_requirements');
  });

  it('rejects an empty candidate list', () => {
    const policy = new LoadAwarePolicy();

    expect(() => policy.select([], 'extract_requirements')).toThrow(
      'No node available for aspect: extract_requirements',
    );
  });

  it('preserves deterministic tie-breaking', () => {
    const policy = new LoadAwarePolicy();

    const first = new TestNode('first', 1, {
      status: 'healthy',
      load: 0,
    });

    const second = new TestNode('second', 1, {
      status: 'healthy',
      load: 0,
    });

    expect(policy.select([first, second], 'extract_requirements')).toBe(first);
  });

  it('supports nodes without health providers', () => {
    const policy = new LoadAwarePolicy();

    const legacy: ModelNode = {
      nodeId: 'legacy',

      capabilities() {
        return [
          {
            aspect: 'extract_requirements',
            quality: 1,
            contextWindow: 8192,
            local: true,
          },
        ];
      },

      async execute(task) {
        return {
          taskId: task.id,
          success: true,
          output: {},
          metadata: {
            nodeId: 'legacy',
          },
        };
      },
    };

    expect(policy.select([legacy], 'extract_requirements')).toBe(legacy);
  });

  it('delegates scoring to the supplied scorer', () => {
    const node = new TestNode('node');

    const scorer: NodeScorer = {
      score: vi.fn((candidate, context): NodeScore => ({
        node: candidate,
        score: 42,
        quality: 1,
        health: 1,
        load: 0,
      })),
    };

    const policy = new LoadAwarePolicy(scorer);

    expect(policy.select([node], 'extract_requirements')).toBe(node);

    expect(scorer.score).toHaveBeenCalledWith(
      node,
      expect.objectContaining({
        aspect: 'extract_requirements',
      }),
    );
  });

  it('filters candidates based on scorer health', () => {
    const unavailable = new TestNode('unavailable');

    const healthy = new TestNode('healthy');

    const scorer: NodeScorer = {
      score: vi.fn((node): NodeScore => ({
        node,
        score: node.nodeId === 'unavailable' ? 100 : 1,
        quality: 1,
        health: node.nodeId === 'unavailable' ? 0 : 1,
        load: 0,
      })),
    };

    const policy = new LoadAwarePolicy(scorer);

    expect(policy.select([unavailable, healthy], 'extract_requirements')).toBe(
      healthy,
    );
  });

  it('can select a lower-quality node when load advantage is sufficient', () => {
    const policy = new LoadAwarePolicy();

    const highQualityBusy = new TestNode('high-quality-busy', 1, {
      status: 'healthy',
      load: 1,
    });

    const lowerQualityIdle = new TestNode('lower-quality-idle', 0.8, {
      status: 'healthy',
      load: 0,
    });

    expect(
      policy.select(
        [highQualityBusy, lowerQualityIdle],
        'extract_requirements',
      ),
    ).toBe(lowerQualityIdle);
  });
});
