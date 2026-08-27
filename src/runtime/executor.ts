import type { Result } from '../core/result.js';
import type { Task } from '../core/task.js';
import { NodeSelector } from './node-selector.js';
import { NodeRegistry } from './registry.js';
import { RetryPolicy } from './retry-policy.js';

export class Executor {
  constructor(
    private readonly registry: NodeRegistry,
    private readonly selector: NodeSelector,
    private readonly retryPolicy?: RetryPolicy,
  ) {}

  async execute(task: Task): Promise<Result> {
    const candidates = [...this.registry.findFor(task.aspect)];

    if (candidates.length === 0) {
      throw new Error(`No node available for aspect: ${task.aspect}`);
    }

    const attempted = new Set<string>();

    let lastResult: Result | undefined;

    while (attempted.size < candidates.length) {
      const available = candidates.filter((node) => !attempted.has(node.id));

      const node = this.selector.select(
        available,
        task.aspect,
        task.requirements,
      );

      attempted.add(node.id);

      const result = await this.executeOn(task, node.id);

      if (result.success) {
        return result;
      }

      lastResult = result;
    }

    // We know at least one candidate
    // was attempted, so lastResult exists.
    if (!lastResult) {
      throw new Error('Executor failed without producing a result');
    }

    return lastResult;
  }

  async executeOn(task: Task, nodeId: string): Promise<Result> {
    const node = this.registry.get(nodeId);

    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    let attempt = 1;

    while (true) {
      try {
        const result = await node.execute(task);

        if (result.success) {
          return result;
        }

        if (
          !this.retryPolicy ||
          !this.retryPolicy.shouldRetry(attempt, result.error)
        ) {
          return result;
        }
      } catch (error) {
        if (
          !this.retryPolicy ||
          !this.retryPolicy.shouldRetry(attempt, error)
        ) {
          return {
            taskId: task.id,
            success: false,
            output: null,
            metadata: {
              nodeId: node.id,
            },
            error: {
              code: 'NODE_EXECUTION_FAILED',
              message: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }

      attempt++;
    }
  }
}
