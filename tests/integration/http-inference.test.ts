import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { HttpInferenceProvider } from '../../src/inference/http.js';

describe('HTTP inference integration', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );

    servers.length = 0;
  });

  it('executes an inference request through a real HTTP server', async () => {
    const server = createServer(async (request, response) => {
      expect(request.method).toBe('POST');
      expect(request.url).toBe('/inference');

      let body = '';

      for await (const chunk of request) {
        body += chunk;
      }

      const parsed = JSON.parse(body);

      expect(parsed.taskId).toBe('task-1');
      expect(parsed.aspect).toBe('extract_requirements');
      expect(parsed.input).toEqual({
        objective: 'Extract requirements for a CoreXY machine',
      });

      response.writeHead(200, {
        'content-type': 'application/json',
      });

      response.end(
        JSON.stringify({
          success: true,
          output: {
            requirements: ['CoreXY motion', 'Belt-driven XY movement'],
          },
          metadata: {
            model: 'integration-test-model',
          },
        }),
      );
    });

    servers.push(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to determine server address');
    }

    const provider = new HttpInferenceProvider({
      id: 'integration-http',
      baseUrl: `http://127.0.0.1:${address.port}`,
    });

    const response = await provider.execute({
      taskId: 'task-1',
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
        requirements: 'string[]',
      },
    });

    expect(response.success).toBe(true);

    expect(response.output).toEqual({
      requirements: ['CoreXY motion', 'Belt-driven XY movement'],
    });

    expect(response.metadata?.model).toBe('integration-test-model');
    expect(response.metadata?.latencyMs).toBeTypeOf('number');
  });
});
