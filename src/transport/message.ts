import type { InferenceResponse } from '../inference/response.js';

export interface WorkerResponse extends InferenceResponse {
  taskId: string;
}
