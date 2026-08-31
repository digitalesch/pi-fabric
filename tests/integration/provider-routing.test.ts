import { describe, expect, it } from 'vitest';

import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { InferenceNode } from '../../src/nodes/inference-node.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { PerformanceRegistry } from '../../src/runtime/performance-registry.js';

describe('Provider routing', () => {
  it('creates an inference node for a provider', () => {
    const fakeProvider = new FakeInferenceProvider();

    const node = new InferenceNode(
      `${fakeProvider.id}-inference`,
      'fake',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.8,
          contextWindow: 4096,
          local: true,
          latencyMs: 1,
        },
      ],
      {
        send: (request) => fakeProvider.execute(request),
      },
    );

    const registry = new NodeRegistry();

    registry.register(node);

    const nodes = registry.findFor('extract_requirements');

    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeId).toBe('fake-inference');
  });

  it('selects the highest-quality provider node', () => {
    const lowQuality = new InferenceNode(
      'low-quality',
      'fake',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.7,
          contextWindow: 4096,
          local: true,
          latencyMs: 100,
        },
      ],
      {
        send: async () => {
          throw new Error('not executed');
        },
      },
    );

    const highQuality = new InferenceNode(
      'high-quality',
      'fake',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.95,
          contextWindow: 4096,
          local: true,
          latencyMs: 400,
        },
      ],
      {
        send: async () => {
          throw new Error('not executed');
        },
      },
    );

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const selected = selector.select(
      [lowQuality, highQuality],
      'extract_requirements',
    );

    expect(selected.nodeId).toBe('high-quality');
  });
});
