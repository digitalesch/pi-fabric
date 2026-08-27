import { describe, expect, it } from 'vitest';

import { FakeInferenceProvider } from '../../src/inference/fake.js';

describe('InferenceProvider', () => {
  it('executes an inference request', async () => {
    const provider = new FakeInferenceProvider();

    const request = {
      taskId: 'task-1',

      aspect: 'extract_requirements',

      input: {
        design: 'CoreXY printer',
      },

      context: {
        facts: {
          material: 'aluminum',
        },

        constraints: ['Use metric units'],

        assumptions: [],

        references: [],
      },

      outputSchema: {
        requirements: 'string[]',
      },
    };

    const response = await provider.execute(request);

    expect(response.success).toBe(true);

    expect(response.output).toBeDefined();

    expect(provider.lastRequest).toEqual(request);
  });
});
