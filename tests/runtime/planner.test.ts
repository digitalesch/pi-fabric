import { describe, expect, it } from 'vitest';

import { LocalNode } from '../../src/nodes/local.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { Planner } from '../../src/runtime/planner.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { FakeInferenceProvider } from '../../src/inference/fake.js';

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

    const policy = new QualityFirstPolicy();

    const selector = new NodeSelector(policy);

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
});
