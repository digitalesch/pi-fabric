import type { InferenceRequest } from './request.js';
import type { InferenceResponse } from './response.js';

export interface InferenceProvider {
  readonly id: string;

  execute(request: InferenceRequest): Promise<InferenceResponse>;
}
