import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';
import type { PerformanceRegistry } from './performance-registry.js';

export interface SchedulingContext {
  performance?: PerformanceRegistry;
}

export interface SchedulingPolicy {
  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
    context?: SchedulingContext,
  ): ModelNode;
}
