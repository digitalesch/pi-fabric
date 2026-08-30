import { afterEach, describe, expect, it } from 'vitest';

import { NeedleProvider } from '../../src/inference/needle.js';
import { createFabric } from '../../src/create-fabric.js';

describe('NeedleProvider', () => {
  let provider: NeedleProvider | undefined;

  afterEach(async () => {
    await provider?.close();
  });

  it('closes the provider through Fabric', async () => {
    const provider = new NeedleProvider();

    const fabric = createFabric({
      providers: [provider],
    });

    await fabric.close();
  });

  it('executes inference through Needle', async () => {
    provider = new NeedleProvider();

    const response = await provider.execute({
      taskId: 'needle-provider-1',

      aspect: 'extract_requirements',

      input: {
        objective: 'CoreXY machine',
      },

      context: {
        facts: {},
        constraints: [],
        assumptions: [],
        references: [],
      },

      outputSchema: {
        type: 'object',
        properties: {
          requirements: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        required: ['requirements'],
      },
    });

    expect(response.success, JSON.stringify(response, null, 2)).toBe(true);
    expect(response.output).toBeDefined();
    expect(response.metadata?.model).toBe('needle');
  }, 30_000);
});
