import type { ModelNode } from '../../src/nodes/node.js';
import type { Capability } from '../../src/core/capability.js';
import type { Task } from '../../src/core/task.js';
import type { Result } from '../../src/core/result.js';

export class FailThenSucceedNode implements ModelNode {
  public attempts = 0;

  constructor(
    public readonly nodeId: string,
    private readonly failures: number,
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

  async execute(task: Task): Promise<Result> {
    this.attempts++;

    if (this.attempts <= this.failures) {
      return {
        taskId: task.id,
        success: false,
        output: null,
        metadata: {
          nodeId: this.nodeId,
        },
        error: {
          code: 'TEMPORARY_FAILURE',
          message: 'temporary failure',
        },
      };
    }

    return {
      taskId: task.id,
      success: true,
      output: {
        recovered: true,
      },
      metadata: {
        nodeId: this.nodeId,
      },
    };
  }
}
