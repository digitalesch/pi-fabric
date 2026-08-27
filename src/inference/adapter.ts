import type { Result } from '../core/result.js';
import type { Task } from '../core/task.js';
import type { InferenceRequest } from './request.js';
import type { InferenceResponse } from './response.js';

export function taskToRequest(task: Task): InferenceRequest {
  return {
    taskId: task.id,
    aspect: task.aspect,
    input: task.input,
    context: task.context,
    outputSchema: task.outputSchema,
  };
}

export function responseToResult(
  task: Task,
  response: InferenceResponse,
): Result {
  return {
    taskId: task.id,

    success: response.success,

    output: response.output,

    metadata: {
      nodeId: '',

      model: response.metadata?.model,

      latencyMs: response.metadata?.latencyMs,

      inputTokens: response.metadata?.inputTokens,

      outputTokens: response.metadata?.outputTokens,
    },
  };
}
