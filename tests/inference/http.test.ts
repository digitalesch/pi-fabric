import { describe, expect, it, vi } from 'vitest';

import { HttpInferenceProvider } from '../../src/inference/http.js';
import type { InferenceRequest } from '../../src/inference/request.js';

const request: InferenceRequest = {
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
};

describe('HttpInferenceProvider', () => {
  it('sends an inference request and returns the response', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          output: {
            requirements: ['CoreXY motion'],
          },
          metadata: {
            model: 'test-model',
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const provider = new HttpInferenceProvider({
      id: 'test-http',
      baseUrl: 'http://localhost:3000/',
      fetch,
    });

    const response = await provider.execute(request);

    expect(provider.id).toBe('test-http');
    expect(response.success).toBe(true);
    expect(response.output).toEqual({
      requirements: ['CoreXY motion'],
    });
    expect(response.metadata?.model).toBe('test-model');
    expect(response.metadata?.latencyMs).toBeTypeOf('number');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/inference',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      }),
    );
  });

  it('returns a structured response for an HTTP error', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('server error', {
        status: 503,
      }),
    );

    const provider = new HttpInferenceProvider({
      id: 'test-http',
      baseUrl: 'http://localhost:3000',
      fetch,
    });

    const response = await provider.execute(request);

    expect(response.success).toBe(false);
    expect(response.output).toBeNull();
    expect(response.error).toEqual({
      code: 'INFERENCE_HTTP_ERROR',
      message: 'Inference server returned HTTP 503',
    });
    expect(response.metadata?.latencyMs).toBeTypeOf('number');
  });

  it('returns a structured response for invalid JSON', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('not-json', {
        status: 200,
      }),
    );

    const provider = new HttpInferenceProvider({
      id: 'test-http',
      baseUrl: 'http://localhost:3000',
      fetch,
    });

    const response = await provider.execute(request);

    expect(response.success).toBe(false);
    expect(response.error).toEqual({
      code: 'INFERENCE_INVALID_RESPONSE',
      message: 'Inference server returned invalid JSON',
    });
  });

  it('returns a structured response for an invalid response shape', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ output: 'missing success' }), {
        status: 200,
      }),
    );

    const provider = new HttpInferenceProvider({
      id: 'test-http',
      baseUrl: 'http://localhost:3000',
      fetch,
    });

    const response = await provider.execute(request);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('INFERENCE_INVALID_RESPONSE');
  });

  it('returns a structured response when the connection fails', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new Error('connection refused'));

    const provider = new HttpInferenceProvider({
      id: 'test-http',
      baseUrl: 'http://localhost:3000',
      fetch,
    });

    const response = await provider.execute(request);

    expect(response.success).toBe(false);
    expect(response.output).toBeNull();
    expect(response.error).toEqual({
      code: 'INFERENCE_CONNECTION_ERROR',
      message: 'connection refused',
    });
    expect(response.metadata?.latencyMs).toBeTypeOf('number');
  });
});
