import { describe, expect, it } from 'vitest';

import { InferenceNode } from '../../src/nodes/inference-node.js';
import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { InProcessTransport } from '../../src/transport/in-process.js';

describe('InferenceNode', () => {
  it('executes a task through inference transport', async () => {
    const provider = new FakeInferenceProvider();

    const transport = new InProcessTransport(provider);

    const node = new InferenceNode(
      'local-extractor',
      [
        {
          aspect: 'extract_requirements',

          quality: 0.8,

          contextWindow: 4096,

          local: true,
        },
      ],
      transport,
    );

    const result = await node.execute({
      id: 'task-1',

      aspect: 'extract_requirements',

      input: {
        description: 'Analyze this mechanical design.',
      },

      context: {
        facts: {},
        constraints: [],
        assumptions: [],
        references: [],
      },

      outputSchema: {
        type: 'object',
      },

      dependencies: [],
    });

    expect(result.success).toBe(true);

    expect(result.taskId).toBe('task-1');

    expect(result.metadata.nodeId).toBe('local-extractor');

    expect(result.metadata.model).toBe('fake-model');
  });
});
