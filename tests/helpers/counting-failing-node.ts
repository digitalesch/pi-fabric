import { ModelNode } from '../../src/nodes/node.js';
import { Capability } from '../../src/core/capability.js';
import { Task } from '../../src/core/task.js';
import { Result } from '../../src/core/result.js';

export class CountingFailingNode implements ModelNode {
  public attempts = 0;

  constructor(public readonly id: string) {}

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

  async execute(task: Task): Promise<Result> {
    this.attempts++;

    return {
      taskId: task.id,
      success: false,
      output: null,
      metadata: {
        nodeId: this.id,
      },
      error: {
        code: 'TEMPORARY_FAILURE',
        message: 'temporary failure',
      },
    };
  }
}
