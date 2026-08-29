import { afterEach, describe, expect, it } from 'vitest';

import { NeedleProvider } from '../../src/inference/needle.js';

describe('NeedleProvider', () => {
  let provider: NeedleProvider | undefined;

  afterEach(async () => {
    await provider?.close();
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
