import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';
import type { PerformanceRegistry } from './performance-registry.js';
import type { SchedulingPolicy } from './scheduling-policy.js';

export class NodeSelector {
  constructor(
    private readonly policy: SchedulingPolicy,
    private readonly performanceRegistry?: PerformanceRegistry,
  ) {}

  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
  ): ModelNode {
    return this.policy.select(nodes, aspect, requirements, {
      performance: this.performanceRegistry,
    });
  }
}
