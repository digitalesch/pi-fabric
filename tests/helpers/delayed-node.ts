import { ModelNode } from '../../src/nodes/node.js';
import { Task } from '../../src/core/task.js';
import { Capability } from '../../src/core/capability.js';
import { Result } from '../../src/core/result.js';

export class DelayedNode implements ModelNode {
  public active = 0;
  public maxActive = 0;

  constructor(
    public readonly nodeId: string,
    private readonly delayMs: number,
    private readonly events: string[],
  ) {}

  capabilities(): Capability[] {
    return [];
  }

  async execute(task: Task): Promise<Result> {
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);

    this.events.push(`${task.id}:start`);

    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    this.events.push(`${task.id}:end`);

    this.active--;

    return {
      taskId: task.id,
      success: true,
      output: task.id,
      metadata: {
        nodeId: this.nodeId,
      },
    };
  }
}
