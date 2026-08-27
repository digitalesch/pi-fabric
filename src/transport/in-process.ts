import type { InferenceProvider } from '../inference/provider.js';
import type { InferenceRequest } from '../inference/request.js';
import type { InferenceResponse } from '../inference/response.js';
import type { Transport } from './transport.js';

export class InProcessTransport implements Transport {
  constructor(private readonly provider: InferenceProvider) {}

  async send(request: InferenceRequest): Promise<InferenceResponse> {
    return this.provider.execute(request);
  }
}
