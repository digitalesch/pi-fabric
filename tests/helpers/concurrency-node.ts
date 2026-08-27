import { ModelNode } from '../../src/nodes/node.js';
import { Capability } from '../../src/core/capability.js';
import { Task } from '../../src/core/task.js';
import { Result } from '../../src/core/result.js';

export class ConcurrencyNode implements ModelNode {
  public active = 0;
  public maxActive = 0;
  public receivedTasks: Task[] = [];

  constructor(
    public readonly id: string,
    private readonly delayMs = 10,
  ) {}

  capabilities(): Capability[] {
    return [
      {
        aspect: 'extract_requirements',
        quality: 0.8,
        contextWindow: 8192,
        local: true,
      },
    ];
  }

  async execute(task: Task): Promise<Result> {
    this.receivedTasks.push(task);

    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);

    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    this.active--;

    return {
      taskId: task.id,
      success: true,
      output: {
        executedBy: this.id,
      },
      metadata: {
        nodeId: this.id,
      },
    };
  }
}
