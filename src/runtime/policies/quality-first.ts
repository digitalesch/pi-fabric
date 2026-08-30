import type { ExecutionRequirements } from '../../core/execution-requirements.js';
import type { ModelNode } from '../../nodes/node.js';

import { NodeEligibility } from '../node-eligibility.js';
import type { PerformanceRegistry } from '../performance-registry.js';
import type { SchedulingPolicy } from '../scheduling-policy.js';

export class QualityFirstPolicy implements SchedulingPolicy {
  constructor(
    private readonly eligibility = new NodeEligibility(),
    private readonly performanceRegistry?: PerformanceRegistry,
  ) {}

  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
  ): ModelNode {
    const candidates = nodes.filter((node) =>
      this.eligibility.satisfies(node, aspect, requirements),
    );

    if (candidates.length === 0) {
      throw new Error(
        `No node satisfies requirements for aspect: ${aspect}`,
      );
    }

    return candidates.reduce((best, current) => {
      const bestScore = this.score(best, aspect);
      const currentScore = this.score(current, aspect);

      return currentScore > bestScore ? current : best;
    });
  }

  private score(
    node: ModelNode,
    aspect: string,
  ): number {
    const capability = node
      .capabilities()
      .find((capability) => capability.aspect === aspect);

    if (!capability) {
      return Number.NEGATIVE_INFINITY;
    }

    const observed = this.performanceRegistry?.profile(
      node.nodeId,
      aspect,
    );

    if (!observed || observed.executions === 0) {
      return capability.quality;
    }

    return (
      capability.quality * (1 - observed.confidence) +
      (observed.averageQuality ?? capability.quality) *
        observed.confidence
    );
  }
}