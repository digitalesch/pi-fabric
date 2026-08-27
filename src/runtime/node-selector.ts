import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';
import type { SchedulingPolicy } from './scheduling-policy.js';

export class NodeSelector {
  constructor(private readonly policy: SchedulingPolicy) {}

  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
  ): ModelNode {
    return this.policy.select(nodes, aspect, requirements);
  }
}
