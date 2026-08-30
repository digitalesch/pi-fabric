import { describe, expect, it } from 'vitest';

import type { Capability } from '../../src/core/capability.js';
import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';

import type { ModelNode } from '../../src/nodes/node.js';
import type { NodeHealth } from '../../src/nodes/node-health.js';

import { DefaultNodeScorer } from '../../src/scheduling/default-node-scorer.js';

const createTask = (): Task => ({
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
});

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

  health(): NodeHealth | undefined {
    return this.nodeHealth;
  }
}

const score = (node: ModelNode, scorer = new DefaultNodeScorer()) =>
  scorer.score(node, {
    aspect: 'extract_requirements',
  });

describe('DefaultNodeScorer', () => {
  it('scores a healthy node', () => {
    const result = score(
      new TestNode('node', 1, {
        status: 'healthy',
        load: 0,
      }),
    );

    expect(result.node.nodeId).toBe('node');
    expect(result.quality).toBe(1);
    expect(result.health).toBe(1);
    expect(result.load).toBe(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('uses capability quality', () => {
    const high = score(new TestNode('high', 1));

    const low = score(new TestNode('low', 0.5));

    expect(high.quality).toBe(1);
    expect(low.quality).toBe(0.5);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('rewards healthy nodes', () => {
    const healthy = score(
      new TestNode('healthy', 1, {
        status: 'healthy',
      }),
    );

    const degraded = score(
      new TestNode('degraded', 1, {
        status: 'degraded',
      }),
    );

    expect(healthy.health).toBe(1);
    expect(degraded.health).toBe(0.5);
    expect(healthy.score).toBeGreaterThan(degraded.score);
  });

  it('penalizes load', () => {
    const idle = score(
      new TestNode('idle', 1, {
        status: 'healthy',
        load: 0,
      }),
    );

    const busy = score(
      new TestNode('busy', 1, {
        status: 'healthy',
        load: 1,
      }),
    );

    expect(idle.load).toBe(0);
    expect(busy.load).toBe(1);
    expect(idle.score).toBeGreaterThan(busy.score);
  });

  it('clamps negative load to zero', () => {
    const result = score(
      new TestNode('node', 1, {
        status: 'healthy',
        load: -10,
      }),
    );

    expect(result.load).toBe(0);
  });

  it('clamps load above one', () => {
    const result = score(
      new TestNode('node', 1, {
        status: 'healthy',
        load: 10,
      }),
    );

    expect(result.load).toBe(1);
  });

  it('uses zero load when load is unavailable', () => {
    const result = score(
      new TestNode('node', 1, {
        status: 'healthy',
      }),
    );

    expect(result.load).toBe(0);
  });

  it('treats nodes without health information as healthy', () => {
    const result = score(new TestNode('legacy', 1));

    expect(result.health).toBe(1);
    expect(result.load).toBe(0);
  });

  it('scores degraded health as half health', () => {
    const result = score(
      new TestNode('node', 1, {
        status: 'degraded',
      }),
    );

    expect(result.health).toBe(0.5);
  });

  it('scores unavailable health as zero', () => {
    const result = score(
      new TestNode('node', 1, {
        status: 'unavailable',
      }),
    );

    expect(result.health).toBe(0);
  });

  it('supports custom weights', () => {
    const scorer = new DefaultNodeScorer(1, 0, 0);

    const high = score(new TestNode('high', 1), scorer);

    const low = score(new TestNode('low', 0.5), scorer);

    expect(high.score).toBe(1);
    expect(low.score).toBe(0.5);
  });

  it('can ignore quality', () => {
    const scorer = new DefaultNodeScorer(0, 1, 0);

    const healthy = score(
      new TestNode('healthy', 0.1, {
        status: 'healthy',
      }),
      scorer,
    );

    const degraded = score(
      new TestNode('degraded', 1, {
        status: 'degraded',
      }),
      scorer,
    );

    expect(healthy.score).toBe(1);
    expect(degraded.score).toBe(0.5);
  });

  it('can ignore health', () => {
    const scorer = new DefaultNodeScorer(1, 0, 0);

    const healthy = score(
      new TestNode('healthy', 0.5, {
        status: 'healthy',
      }),
      scorer,
    );

    const degraded = score(
      new TestNode('degraded', 1, {
        status: 'degraded',
      }),
      scorer,
    );

    expect(degraded.score).toBeGreaterThan(healthy.score);
  });

  it('can ignore load', () => {
    const scorer = new DefaultNodeScorer(1, 0, 0);

    const idle = score(
      new TestNode('idle', 1, {
        status: 'healthy',
        load: 0,
      }),
      scorer,
    );

    const busy = score(
      new TestNode('busy', 1, {
        status: 'healthy',
        load: 1,
      }),
      scorer,
    );

    expect(idle.score).toBe(busy.score);
  });

  it('passes the requested aspect through scoring context', () => {
    const scorer = new DefaultNodeScorer();

    const node: ModelNode = {
      nodeId: 'node',

      capabilities() {
        return [
          {
            aspect: 'other',
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
            nodeId: 'node',
          },
        };
      },
    };

    const result = scorer.score(node, {
      aspect: 'extract_requirements',
    });

    expect(result.quality).toBe(0);
  });

  it('throws for zero total weight', () => {
    expect(() => new DefaultNodeScorer(0, 0, 0)).toThrow(
      'Node scorer weights must have a positive total',
    );
  });

  it('throws for negative total weight', () => {
    expect(() => new DefaultNodeScorer(-1, 0, 0)).toThrow(
      'Node scorer weights must have a positive total',
    );
  });
});
