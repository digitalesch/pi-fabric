import type { InferenceProvider } from './provider.js';
import type { InferenceRequest } from './request.js';
import type { InferenceResponse } from './response.js';

export class FakeInferenceProvider implements InferenceProvider {
  readonly id = 'fake';

  public lastRequest?: InferenceRequest;

  async execute(request: InferenceRequest): Promise<InferenceResponse> {
    this.lastRequest = request;

    return {
      success: true,

      output: {
        aspect: request.aspect,

        inputReceived: request.input,

        message: `Worker executed ${request.aspect}`,
      },

      metadata: {
        model: 'fake-model',
        latencyMs: 1,
      },
    };
  }
}
