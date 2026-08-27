import type { Capability } from '../../src/core/capability.js';
import type { Result } from '../../src/core/result.js';
import type { Task } from '../../src/core/task.js';
import type { ModelNode } from '../../src/nodes/node.js';

export class RecordingNode implements ModelNode {
  public readonly receivedTasks: Task[] = [];

  constructor(
    public readonly id: string,
    private readonly capability: Capability = {
      aspect: 'extract_requirements',
      quality: 0.8,
      contextWindow: 8192,
      local: true,
    },
  ) {}

  capabilities(): Capability[] {
    return [this.capability];
  }

  async execute(task: Task): Promise<Result> {
    this.receivedTasks.push(task);

    return {
      taskId: task.id,
      success: true,
      output: {
        requirements: ['test requirement'],
        executedBy: this.id,
      },
      metadata: {
        nodeId: this.id,
      },
    };
  }
}
