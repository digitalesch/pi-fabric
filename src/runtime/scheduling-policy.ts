import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';

export interface SchedulingPolicy {
  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
  ): ModelNode;
}
