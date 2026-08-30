import { describe, expect, it } from 'vitest';

import { LocalNode } from '../../../src/nodes/local.js';
import { QualityFirstPolicy } from '../../../src/runtime/policies/quality-first.js';
import { FakeInferenceProvider } from '../../../src/inference/fake.js';

describe('QualityFirstPolicy', () => {
  it('selects the highest quality node', () => {
    const provider = new FakeInferenceProvider();

    const small = new LocalNode(
      'small',
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
      'large',
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

    const policy = new QualityFirstPolicy();

    const selected = policy.select([small, large], 'extract_requirements');

    expect(selected.nodeId).toBe('large');
  });

  it('filters nodes using execution requirements', () => {
    const provider = new FakeInferenceProvider();

    const small = new LocalNode(
      'small',
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
      'large',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.9,
          contextWindow: 16384,
          latencyMs: 200,
          local: true,
        },
      ],
      provider,
    );

    const policy = new QualityFirstPolicy();

    const selected = policy.select([small, large], 'extract_requirements', {
      minimumQuality: 0.8,
      minimumContextWindow: 8192,
    });

    expect(selected.nodeId).toBe('large');
  });

  it('can require local execution', () => {
    const provider = new FakeInferenceProvider();

    const remote = new LocalNode(
      'remote',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.99,
          contextWindow: 32768,
          latencyMs: 500,
          local: false,
        },
      ],
      provider,
    );

    const local = new LocalNode(
      'local',
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

    const policy = new QualityFirstPolicy();

    const selected = policy.select([remote, local], 'extract_requirements', {
      localOnly: true,
    });

    expect(selected.nodeId).toBe('local');
  });
});
