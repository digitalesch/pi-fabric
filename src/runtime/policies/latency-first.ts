import type { ExecutionRequirements } from '../../core/execution-requirements.js';
import type { ModelNode } from '../../nodes/node.js';
import { NodeEligibility } from '../node-eligibility.js';
import type { SchedulingPolicy } from '../scheduling-policy.js';

export class LatencyFirstPolicy implements SchedulingPolicy {
  constructor(private readonly eligibility = new NodeEligibility()) {}

  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
  ): ModelNode {
    const candidates = nodes.filter((node) =>
      this.eligibility.satisfies(node, aspect, requirements),
    );

    if (candidates.length === 0) {
      throw new Error(`No node satisfies requirements for aspect: ${aspect}`);
    }

    return candidates.reduce((best, current) => {
      const bestCapability = best
        .capabilities()
        .find((capability) => capability.aspect === aspect);

      const currentCapability = current
        .capabilities()
        .find((capability) => capability.aspect === aspect);

      if (!bestCapability) {
        return current;
      }

      if (!currentCapability) {
        return best;
      }

      if (bestCapability.latencyMs === undefined) {
        return current;
      }

      if (currentCapability.latencyMs === undefined) {
        return best;
      }

      return currentCapability.latencyMs < bestCapability.latencyMs
        ? current
        : best;
    });
  }
}
