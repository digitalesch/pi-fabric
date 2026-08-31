import { describe, expect, it } from 'vitest';

import { RecordingNode } from '../../helpers/recording-node.js';
import { NodeRegistry } from '../../../src/index.js';
import { PerformanceRegistry } from '../../../src/runtime/performance-registry.js';
import { NodeSelector } from '../../../src/index.js';
import { AdaptivePolicy } from '../../../src/runtime/policies/adaptative-policy.js';

describe;
it('uses capability quality when there is no performance history', () => {
  const low = new RecordingNode('low', {
    aspect: 'extract_requirements',
    quality: 0.6,
    contextWindow: 4096,
    local: true,
  });

  const high = new RecordingNode('high', {
    aspect: 'extract_requirements',
    quality: 0.9,
    contextWindow: 4096,
    local: true,
  });

  const registry = new NodeRegistry();

  registry.register(low);
  registry.register(high);

  const performance = new PerformanceRegistry();

  const selector = new NodeSelector(new AdaptivePolicy(), performance);

  const selected = selector.select([low, high], 'extract_requirements');

  expect(selected.nodeId).toBe('high');
});
