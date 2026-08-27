import type { InferenceProvider } from '../inference/provider.js';
import type { InferenceRequest } from '../inference/request.js';
import type { InferenceResponse } from '../inference/response.js';

export class Worker {
  constructor(private readonly provider: InferenceProvider) {}

  async handle(request: InferenceRequest): Promise<InferenceResponse> {
    return this.provider.execute(request);
  }
}
