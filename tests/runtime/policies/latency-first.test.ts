import { describe, expect, it } from 'vitest';

import type { Capability } from '../../../src/core/capability.js';
import type { Result } from '../../../src/core/result.js';
import type { Task } from '../../../src/core/task.js';
import type { ModelNode } from '../../../src/nodes/node.js';

import { LatencyFirstPolicy } from '../../../src/runtime/policies/latency-first.js';

class TestNode implements ModelNode {
  constructor(
    public readonly id: string,
    private readonly capability: Capability,
  ) {}

  capabilities(): Capability[] {
    return [this.capability];
  }

  async execute(_task: Task): Promise<Result> {
    throw new Error('TestNode should not execute');
  }
}

describe('LatencyFirstPolicy', () => {
  const policy = new LatencyFirstPolicy();

  it('selects the lowest-latency eligible node', () => {
    const slow = new TestNode('slow', {
      aspect: 'extract_requirements',
      quality: 0.95,
      contextWindow: 16384,
      latencyMs: 200,
      local: true,
    });

    const fast = new TestNode('fast', {
      aspect: 'extract_requirements',
      quality: 0.7,
      contextWindow: 8192,
      latencyMs: 50,
      local: true,
    });

    const selected = policy.select([slow, fast], 'extract_requirements');

    expect(selected.id).toBe('fast');
  });

  it('applies requirements before latency ranking', () => {
    const fastButTooSmall = new TestNode('fast-but-too-small', {
      aspect: 'extract_requirements',
      quality: 0.95,
      contextWindow: 4096,
      latencyMs: 20,
      local: true,
    });

    const slowerEligible = new TestNode('slower-eligible', {
      aspect: 'extract_requirements',
      quality: 0.7,
      contextWindow: 16384,
      latencyMs: 100,
      local: true,
    });

    const selected = policy.select(
      [fastButTooSmall, slowerEligible],
      'extract_requirements',
      {
        minimumContextWindow: 8192,
      },
    );

    expect(selected.id).toBe('slower-eligible');
  });

  it('prefers a node with known latency over one without latency', () => {
    const unknown = new TestNode('unknown', {
      aspect: 'extract_requirements',
      quality: 0.95,
      contextWindow: 16384,
      local: true,
    });

    const known = new TestNode('known', {
      aspect: 'extract_requirements',
      quality: 0.7,
      contextWindow: 8192,
      latencyMs: 100,
      local: true,
    });

    const selected = policy.select([unknown, known], 'extract_requirements');

    expect(selected.id).toBe('known');
  });

  it('throws when no node satisfies requirements', () => {
    const node = new TestNode('node', {
      aspect: 'extract_requirements',
      quality: 0.8,
      contextWindow: 4096,
      latencyMs: 50,
      local: true,
    });

    expect(() =>
      policy.select([node], 'extract_requirements', {
        minimumContextWindow: 8192,
      }),
    ).toThrow(
      'No node satisfies requirements for aspect: extract_requirements',
    );
  });
});
