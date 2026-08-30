import type { Capability } from '../core/capability.js';
import type { Result } from '../core/result.js';
import type { Task } from '../core/task.js';
import type { InferenceRequest } from '../inference/request.js';
import type { Transport } from '../transport/transport.js';
import type { ModelNode } from './node.js';

export class InferenceNode implements ModelNode {
  constructor(
    public readonly nodeId: string,
    public readonly providerId: string,
    private readonly nodeCapabilities: Capability[],
    private readonly transport: Transport,
  ) {}

  capabilities(): Capability[] {
    return this.nodeCapabilities;
  }

  async execute(task: Task): Promise<Result> {
    const request: InferenceRequest = {
      taskId: task.id,
      aspect: task.aspect,
      input: task.input,
      context: task.context,
      outputSchema: task.outputSchema,
    };

    const startedAt = Date.now();

    const response = await this.transport.send(request);

    const latencyMs =
      response.metadata?.latencyMs ??
      Date.now() - startedAt;

    return {
      taskId: task.id,
      success: response.success,
      output: response.output,
      metadata: {
        nodeId: this.nodeId,
        ...response.metadata,
        provider: this.providerId,
        latencyMs,
      },
      ...(response.error
        ? {
            error: response.error,
          }
        : {}),
    };
  }
}