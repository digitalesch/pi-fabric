import { describe, expect, it } from 'vitest';

import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { InProcessTransport } from '../../src/transport/in-process.js';

describe('InProcessTransport', () => {
  it('sends an inference request to a provider', async () => {
    const provider = new FakeInferenceProvider();

    const transport = new InProcessTransport(provider);

    const request = {
      taskId: 'task-1',

      aspect: 'extract_requirements',

      input: {
        design: 'CoreXY',
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
    };

    const response = await transport.send(request);

    expect(response.success).toBe(true);

    expect(provider.lastRequest).toEqual(request);
  });
});
