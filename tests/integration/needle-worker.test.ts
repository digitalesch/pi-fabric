import { afterEach, describe, expect, it } from 'vitest';

import { ChildProcessTransport } from '../../src/transport/child-process.js';

describe('Needle worker integration', () => {
  const transports: ChildProcessTransport[] = [];

  afterEach(async () => {
    for (const transport of transports) {
      await transport.close();
    }

    transports.length = 0;
  });

  it('executes structured extraction through the Needle worker', async () => {
    const transport = new ChildProcessTransport(
  '.needle-venv/bin/python',
  ['src/worker/needle_worker.py'],
);

    transports.push(transport);

    const response = await transport.send({
      taskId: 'needle-task-1',

      aspect: 'extract_requirements',

      input: {
        objective: 'Extract requirements for a CoreXY machine',
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
  });
});