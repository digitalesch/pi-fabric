import { afterEach, describe, expect, it } from 'vitest';

import type { Task } from '../../src/core/task.js';

import { InferenceNode } from '../../src/nodes/inference-node.js';
import { NeedleProvider } from '../../src/inference/needle.js';

import { InProcessTransport } from '../../src/transport/in-process.js';

describe('Needle InferenceNode', () => {
  const providers: NeedleProvider[] = [];

  afterEach(async () => {
    for (const provider of providers) {
      await provider.close();
    }

    providers.length = 0;
  });

  it('executes a task through Needle via InferenceNode', async () => {
    const provider = new NeedleProvider();

    providers.push(provider);

    const transport = new InProcessTransport(provider);

    const node = new InferenceNode(
      'needle-local',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.85,
          contextWindow: 4096,
          local: true,
          latencyMs: 400,
        },
      ],
      transport,
    );

    const task: Task = {
      id: 'needle-node-task',
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

      dependencies: [],
    };

    const result = await node.execute(task);

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();

    expect(result.metadata).toMatchObject({
      nodeId: 'needle-local',
      model: 'needle',
    });
  });
});
