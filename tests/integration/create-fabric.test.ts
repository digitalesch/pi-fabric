import { describe, expect, it } from 'vitest';

import { createFabric, type FabricOptions } from '../../src/create-fabric.js';
import { NeedleProvider } from '../../src/inference/needle.js';

describe('createFabric', () => {
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
