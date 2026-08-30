import { describe, expect, it } from 'vitest';

import { createFabric, type FabricOptions } from '../../src/create-fabric.js';
import { NeedleProvider } from '../../src/inference/needle.js';

describe('createFabric', () => {
  it('records performance for configured providers', async () => {
    const provider = new NeedleProvider();

    const fabric = createFabric({
      providers: [provider],
    });

    try {
      await fabric.run({
        description: 'Extract requirements for a CoreXY machine',
      });

      const profile = fabric
        .getPerformanceRegistry()
        .profile('needle-inference', 'extract_requirements');

      expect(profile.executions).toBe(1);
      expect(profile.successRate).toBe(1);
      expect(profile.averageLatencyMs).toBeGreaterThan(0);
    } finally {
      await fabric.close();
    }
  });

  it('exposes performance history', async () => {
    const fabric = createFabric();

    try {
      await fabric.run({
        description: 'Extract requirements for a CoreXY machine',
      });

      const registry = fabric.getPerformanceRegistry();

      const profile = registry.profile('fake-inference', 'extract_requirements');

      expect(profile.executions).toBe(1);
      expect(profile.successRate).toBe(1);
    } finally {
      await fabric.close();
    }
  });

  it('uses the fake inference backend by default', async () => {
    const fabric = createFabric();

    try {
      const result = await fabric.run({
        description: 'Extract requirements for a CoreXY machine',
      });

      expect(result).toBeDefined();
      expect(result).not.toBe('');
    } finally {
      await fabric.close();
    }
  });

  it('accepts the Needle inference backend', async () => {
    const provider = new NeedleProvider();

    const options: FabricOptions = {
      providers: [provider],
    };

    const fabric = createFabric(options);

    try {
      const result = await fabric.run({
        description: 'Extract requirements for a CoreXY machine',
      });

      expect(result).toBeDefined();
      expect(result).not.toBe('');
    } finally {
      await fabric.close();
    }
  });
});
