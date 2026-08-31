import type { Result } from '../core/result.js';
import type { Task } from '../core/task.js';

import { NodeSelector } from './node-selector.js';
import { NodeRegistry } from './registry.js';
import { RetryPolicy } from './retry-policy.js';
import { PerformanceRegistry } from './performance-registry.js';

export class Executor {
  constructor(
    private readonly registry: NodeRegistry,
    private readonly selector: NodeSelector,
    private readonly retryPolicy?: RetryPolicy,
    private readonly performanceRegistry?: PerformanceRegistry,
  ) {}

  /**
   * Execute a logical task.
   *
   * Finds eligible nodes, selects the best one according to the
   * configured policy, and delegates physical execution to executeOn().
   */
  async execute(task: Task): Promise<Result> {
    const candidates = [...this.registry.findFor(task.aspect)];

    if (candidates.length === 0) {
      throw new Error(`No node available for aspect: ${task.aspect}`);
    }

    const attempted = new Set<string>();
    let lastResult: Result | undefined;

    while (attempted.size < candidates.length) {
      const available = candidates.filter(
        (node) => !attempted.has(node.nodeId),
      );

      const node = this.selector.select(
        available,
        task.aspect,
        task.requirements,
      );

      attempted.add(node.nodeId);

      const result = await this.executeOn(task, node.nodeId);

      if (result.success) {
        return result;
      }

      lastResult = result;
    }

    if (!lastResult) {
      throw new Error('Executor failed without producing a result');
    }

    return lastResult;
  }

  /**
   * Execute a task on a specific physical node.
   *
   * Used by PlanExecutor after physical planning.
   * Does not perform node selection.
   *
   * Every execution attempt is recorded independently.
   */
  async executeOn(task: Task, nodeId: string): Promise<Result> {
    const node = this.registry.get(nodeId);

    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    let attempt = 1;

    while (true) {
      try {
        const result = await node.execute(task);

        this.recordPerformance(task, node.nodeId, result);

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
        const result: Result = {
          taskId: task.id,
          success: false,
          output: null,
          metadata: {
            nodeId: node.nodeId,
          },
          error: {
            code: 'NODE_EXECUTION_FAILED',
            message: error instanceof Error ? error.message : String(error),
          },
        };

        this.recordPerformance(task, node.nodeId, result);

        if (
          !this.retryPolicy ||
          !this.retryPolicy.shouldRetry(attempt, error)
        ) {
          return result;
        }
      }

      attempt++;
    }
  }

  private recordPerformance(task: Task, nodeId: string, result: Result): void {
    if (!this.performanceRegistry) {
      return;
    }

    this.performanceRegistry.record({
      nodeId,
      aspect: task.aspect,
      success: result.success,
      latencyMs: result.metadata.latencyMs,
      timestamp: Date.now(),
    });
  }
}
