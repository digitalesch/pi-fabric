import type { Capability } from '../core/capability.js';
import type { Result } from '../core/result.js';
import type { Task } from '../core/task.js';

import type { ModelNode } from './node.js';
import type { NodeHealth, NodeHealthProvider } from './node-health.js';

export type DeterministicHandler = (task: Task) => unknown | Promise<unknown>;

export class DeterministicNode implements ModelNode, NodeHealthProvider {
  constructor(
    public readonly nodeId: string,
    private readonly handler: DeterministicHandler,
    private readonly nodeCapabilities: Capability[] = [],
  ) {}

  capabilities(): Capability[] {
    return this.nodeCapabilities;
  }

  health(): NodeHealth {
    return {
      status: 'healthy',
      latencyMs: 0,
      load: 0,
    };
  }

  async execute(task: Task): Promise<Result> {
    try {
      const output = await this.handler(task);

      return {
        taskId: task.id,
        success: true,
        output,
        metadata: {
          nodeId: this.nodeId,
        },
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        output: null,
        metadata: {
          nodeId: this.nodeId,
        },
        error: {
          code: 'DETERMINISTIC_NODE_FAILURE',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
