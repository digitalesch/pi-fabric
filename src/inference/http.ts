import type { InferenceProvider } from './provider.js';
import type { InferenceRequest } from './request.js';
import type { InferenceResponse } from './response.js';

export interface HttpInferenceProviderOptions {
  id: string;
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

export class HttpInferenceProvider implements InferenceProvider {
  readonly id: string;

  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: HttpInferenceProviderOptions) {
    this.id = options.id;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = {
      'content-type': 'application/json',
      ...options.headers,
    };
    this.fetchFn = options.fetch ?? globalThis.fetch;

    if (!this.fetchFn) {
      throw new Error('No fetch implementation is available');
    }
  }

  async execute(request: InferenceRequest): Promise<InferenceResponse> {
    const startedAt = Date.now();

    let response: Response;

    try {
      response = await this.fetchFn(`${this.baseUrl}/inference`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(request),
      });
    } catch (error) {
      return {
        success: false,
        output: null,
        metadata: {
          latencyMs: Date.now() - startedAt,
        },
        error: {
          code: 'INFERENCE_CONNECTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        success: false,
        output: null,
        metadata: {
          latencyMs,
        },
        error: {
          code: 'INFERENCE_HTTP_ERROR',
          message: `Inference server returned HTTP ${response.status}`,
        },
      };
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      return {
        success: false,
        output: null,
        metadata: {
          latencyMs,
        },
        error: {
          code: 'INFERENCE_INVALID_RESPONSE',
          message: 'Inference server returned invalid JSON',
        },
      };
    }

    if (!isInferenceResponse(payload)) {
      return {
        success: false,
        output: null,
        metadata: {
          latencyMs,
        },
        error: {
          code: 'INFERENCE_INVALID_RESPONSE',
          message: 'Inference server returned an invalid response shape',
        },
      };
    }

    return {
      ...payload,
      metadata: {
        ...payload.metadata,
        latencyMs: payload.metadata?.latencyMs ?? latencyMs,
      },
    };
  }
}

function isInferenceResponse(value: unknown): value is InferenceResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.success === 'boolean' && 'output' in response;
}
