import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';
import {
  type NodeHealthProvider,
  type NodeHealthStatus,
} from '../nodes/node-health.js';

import { SchedulingPolicy } from '../runtime/scheduling-policy.js';

export class HealthAwarePolicy implements SchedulingPolicy {
  constructor(private readonly delegate: SchedulingPolicy) {}

  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
  ): ModelNode {
    const usable = nodes.filter((node) => {
      const health = this.healthOf(node);

      return health.status !== 'unavailable';
    });

    if (usable.length === 0) {
      throw new Error(`No healthy node available for aspect: ${aspect}`);
    }

    return this.delegate.select(usable, aspect, requirements);
  }

  private healthOf(node: ModelNode) {
    if (this.isHealthProvider(node)) {
      return node.health();
    }

    return {
      status: 'healthy' as NodeHealthStatus,
    };
  }

  private isHealthProvider(
    node: ModelNode,
  ): node is ModelNode & NodeHealthProvider {
    return typeof (node as Partial<NodeHealthProvider>).health === 'function';
  }
}
