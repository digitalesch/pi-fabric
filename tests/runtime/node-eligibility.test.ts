import { describe, expect, it } from 'vitest';

import type { Capability } from '../../src/core/capability.js';
import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';
import type { ModelNode } from '../../src/nodes/node.js';

import { NodeEligibility } from '../../src/runtime/node-eligibility.js';

class TestNode implements ModelNode {
  constructor(
    public readonly nodeId: string,
    private readonly capability: Capability,
  ) {}

  capabilities(): Capability[] {
    return [this.capability];
  }

  async execute(_task: Task): Promise<Result> {
    throw new Error('TestNode should not execute');
  }
}

describe('NodeEligibility', () => {
  const eligibility = new NodeEligibility();

  it('rejects a node that does not support the aspect', () => {
    const node = new TestNode('node', {
      aspect: 'summarize',
      quality: 0.9,
      contextWindow: 8192,
      local: true,
    });

    expect(eligibility.satisfies(node, 'extract_requirements')).toBe(false);
  });

  it('accepts a node when there are no requirements', () => {
    const node = new TestNode('node', {
      aspect: 'extract_requirements',
      quality: 0.8,
      contextWindow: 8192,
      local: true,
    });

    expect(eligibility.satisfies(node, 'extract_requirements')).toBe(true);
  });

  it('enforces minimum quality', () => {
    const node = new TestNode('node', {
      aspect: 'extract_requirements',
      quality: 0.7,
      contextWindow: 8192,
      local: true,
    });

    expect(
      eligibility.satisfies(node, 'extract_requirements', {
        minimumQuality: 0.8,
      }),
    ).toBe(false);
  });

  it('enforces minimum context window', () => {
    const node = new TestNode('node', {
      aspect: 'extract_requirements',
      quality: 0.9,
      contextWindow: 4096,
      local: true,
    });

    expect(
      eligibility.satisfies(node, 'extract_requirements', {
        minimumContextWindow: 8192,
      }),
    ).toBe(false);
  });

  it('enforces local-only execution', () => {
    const node = new TestNode('node', {
      aspect: 'extract_requirements',
      quality: 0.9,
      contextWindow: 8192,
      local: false,
    });

    expect(
      eligibility.satisfies(node, 'extract_requirements', { localOnly: true }),
    ).toBe(false);
  });

  it('enforces maximum latency', () => {
    const node = new TestNode('node', {
      aspect: 'extract_requirements',
      quality: 0.9,
      contextWindow: 8192,
      latencyMs: 200,
      local: true,
    });

    expect(
      eligibility.satisfies(node, 'extract_requirements', {
        maximumLatencyMs: 100,
      }),
    ).toBe(false);
  });

  it('rejects a node without latency information when latency is constrained', () => {
    const node = new TestNode('node', {
      aspect: 'extract_requirements',
      quality: 0.9,
      contextWindow: 8192,
      local: true,
    });

    expect(
      eligibility.satisfies(node, 'extract_requirements', {
        maximumLatencyMs: 100,
      }),
    ).toBe(false);
  });

  it('accepts a node that satisfies all requirements', () => {
    const node = new TestNode('node', {
      aspect: 'extract_requirements',
      quality: 0.9,
      contextWindow: 16384,
      latencyMs: 50,
      local: true,
    });

    expect(
      eligibility.satisfies(node, 'extract_requirements', {
        minimumQuality: 0.8,
        minimumContextWindow: 8192,
        localOnly: true,
        maximumLatencyMs: 100,
      }),
    ).toBe(true);
  });
});
