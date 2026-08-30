import type { Capability } from '../core/capability.js';
import type { Result } from '../core/result.js';
import type { Task } from '../core/task.js';
import type { InferenceProvider } from '../inference/provider.js';
import { responseToResult, taskToRequest } from '../inference/adapter.js';
import type { ModelNode } from './node.js';

export class LocalNode implements ModelNode {
  constructor(
    public readonly nodeId: string,
    private readonly nodeCapabilities: Capability[],
    private readonly provider: InferenceProvider,
  ) {}

  capabilities(): Capability[] {
    return this.nodeCapabilities;
  }

  async execute(task: Task): Promise<Result> {
    const request = taskToRequest(task);

    const response = await this.provider.execute(request);

    const result = responseToResult(task, response);

    return {
      ...result,

      metadata: {
        ...result.metadata,

        nodeId: this.nodeId,

        provider: result.metadata.provider ?? this.provider.id,
      },
    };
  }
}
