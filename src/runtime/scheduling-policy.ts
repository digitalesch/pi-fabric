import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';
import type { SchedulingContext } from './scheduling-context.js';

export interface SchedulingPolicy {
  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
    context?: SchedulingContext,
  ): ModelNode;
}