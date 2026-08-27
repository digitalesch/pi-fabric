import type { InferenceRequest } from '../inference/request.js';
import type { InferenceResponse } from '../inference/response.js';

export interface Transport {
  send(request: InferenceRequest): Promise<InferenceResponse>;
}
