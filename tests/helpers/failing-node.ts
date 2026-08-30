import { ModelNode } from '../../src/nodes/node.js';
import { Capability } from '../../src/core/capability.js';
import { Task } from '../../src/core/task.js';
import { Result } from '../../src/core/result.js';

export class FailingNode implements ModelNode {
  constructor(
    public readonly nodeId: string,
    private readonly error: string,
  ) {}

  capabilities(): Capability[] {
    return [
      {
        aspect: 'extract_requirements',
        quality: 0.9,
        contextWindow: 8192,
        local: true,
      },
    ];
  }

  async execute(_task: Task): Promise<Result> {
    throw new Error(this.error);
  }
}
