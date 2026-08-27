import { describe, expect, it } from 'vitest';

import type { Capability } from '../../src/core/capability.js';

describe('Capability', () => {
  it('describes what a node can do', () => {
    const capability: Capability = {
      aspect: 'extract_requirements',
      quality: 0.85,
      contextWindow: 8192,
      latencyMs: 100,
      local: true,
    };

    expect(capability.aspect).toBe('extract_requirements');

    expect(capability.local).toBe(true);
  });
});
