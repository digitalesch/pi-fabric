import type { Context } from '../core/context.js';

export interface InferenceRequest {
  taskId: string;

  aspect: string;

  input: unknown;

  context: Context;

  outputSchema: unknown;
}
