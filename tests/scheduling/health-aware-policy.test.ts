import { describe, expect, it } from 'vitest';

import type { Capability } from '../../src/core/capability.js';
import type { ModelNode } from '../../src/nodes/node.js';
import type { NodeHealth } from '../../src/nodes/node-health.js';
import type { Task } from '../../src/core/task.js';
import type { Result } from '../../src/core/result.js';

import { HealthAwarePolicy } from '../../src/scheduling/health-aware-policy.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';

class TestNode implements ModelNode {
  constructor(
    public readonly id: string,
    private readonly quality: number,
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

  async execute(task: Task): Promise<Result> {
    return {
      taskId: task.id,
      success: true,
      output: {},
      metadata: {
        nodeId: this.id,
      },
    };
  }
}

class HealthNode extends TestNode {
  constructor(
    id: string,
    quality: number,
    private readonly nodeHealth: NodeHealth,
  ) {
    super(id, quality);
  }

  health(): NodeHealth {
    return this.nodeHealth;
  }
}

describe('HealthAwarePolicy', () => {
  it('selects a healthy node', () => {
    const policy = new HealthAwarePolicy(new QualityFirstPolicy());

    const healthy = new HealthNode('healthy', 1, {
      status: 'healthy',
    });

    expect(policy.select([healthy], 'extract_requirements')).toBe(healthy);
  });

  it('ignores unavailable nodes', () => {
    const policy = new HealthAwarePolicy(new QualityFirstPolicy());

    const unavailable = new HealthNode('unavailable', 1, {
      status: 'unavailable',
    });

    const healthy = new HealthNode('healthy', 0.5, {
      status: 'healthy',
    });

    expect(policy.select([unavailable, healthy], 'extract_requirements')).toBe(
      healthy,
    );
  });

  it('prefers quality among healthy nodes', () => {
    const policy = new HealthAwarePolicy(new QualityFirstPolicy());

    const lower = new HealthNode('lower', 0.5, {
      status: 'healthy',
    });

    const higher = new HealthNode('higher', 1, {
      status: 'healthy',
    });

    expect(policy.select([lower, higher], 'extract_requirements')).toBe(higher);
  });

  it('allows degraded nodes when they are the only usable nodes', () => {
    const policy = new HealthAwarePolicy(new QualityFirstPolicy());

    const degraded = new HealthNode('degraded', 1, {
      status: 'degraded',
      latencyMs: 500,
      lastError: 'temporary slowdown',
    });

    expect(policy.select([degraded], 'extract_requirements')).toBe(degraded);
  });

  it('prefers healthy over unavailable regardless of quality', () => {
    const policy = new HealthAwarePolicy(new QualityFirstPolicy());

    const unavailable = new HealthNode('unavailable', 100, {
      status: 'unavailable',
    });

    const healthy = new HealthNode('healthy', 1, {
      status: 'healthy',
    });

    expect(policy.select([unavailable, healthy], 'extract_requirements')).toBe(
      healthy,
    );
  });

  it('throws when every node is unavailable', () => {
    const policy = new HealthAwarePolicy(new QualityFirstPolicy());

    const first = new HealthNode('first', 1, {
      status: 'unavailable',
    });

    const second = new HealthNode('second', 1, {
      status: 'unavailable',
    });

    expect(() =>
      policy.select([first, second], 'extract_requirements'),
    ).toThrow('No healthy node available for aspect: extract_requirements');
  });

  it('treats nodes without health information as healthy', () => {
    const policy = new HealthAwarePolicy(new QualityFirstPolicy());

    const node = new TestNode('legacy', 1);

    expect(policy.select([node], 'extract_requirements')).toBe(node);
  });

  it('preserves the delegated policy semantics', () => {
    const policy = new HealthAwarePolicy(new QualityFirstPolicy());

    const low = new HealthNode('low', 0.2, {
      status: 'healthy',
    });

    const medium = new HealthNode('medium', 0.5, {
      status: 'healthy',
    });

    const high = new HealthNode('high', 0.9, {
      status: 'healthy',
    });

    expect(policy.select([low, medium, high], 'extract_requirements').id).toBe(
      'high',
    );
  });
});
