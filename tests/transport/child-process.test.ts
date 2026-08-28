import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

import { ChildProcessTransport } from '../../src/transport/child-process.js';

const workerPath = resolve(process.cwd(), 'dist', 'worker', 'main.js');

describe('ChildProcessTransport', () => {
  const transports: ChildProcessTransport[] = [];

  afterEach(async () => {
    for (const transport of transports) {
      await transport.close();
    }

    transports.length = 0;
  });

  it('executes a task in a separate worker process', async () => {
    const transport = new ChildProcessTransport(process.execPath, [workerPath]);

    transports.push(transport);

    const response = await transport.send({
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
    });

    expect(response.success).toBe(true);

    expect(response.output).toBeDefined();
  });

  it('correlates concurrent requests', async () => {
    const transport = new ChildProcessTransport(process.execPath, [workerPath]);

    transports.push(transport);

    const requests = ['task-1', 'task-2', 'task-3', 'task-4'].map((taskId) => ({
      taskId,

      aspect: 'extract_requirements',

      input: {
        requestId: taskId,
      },

      context: {
        facts: {},
        constraints: [],
        assumptions: [],
        references: [],
      },

      outputSchema: {},
    }));

    const responses = await Promise.all(
      requests.map((request) => transport.send(request)),
    );

    expect(responses).toHaveLength(4);

    expect(responses.every((response) => response.success)).toBe(true);

    const requestIds = responses.map(
      (response) =>
        (
          response.output as {
            inputReceived: {
              requestId: string;
            };
          }
        ).inputReceived.requestId,
    );

    expect(requestIds).toEqual(['task-1', 'task-2', 'task-3', 'task-4']);
  });
});
