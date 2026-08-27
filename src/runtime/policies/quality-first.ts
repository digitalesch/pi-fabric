import type { ExecutionRequirements } from '../../core/execution-requirements.js';
import type { ModelNode } from '../../nodes/node.js';
import type { SchedulingPolicy } from '../scheduling-policy.js';

export class QualityFirstPolicy implements SchedulingPolicy {
  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
  ): ModelNode {
    const candidates = nodes.filter((node) => {
      const capability = node
        .capabilities()
        .find((capability) => capability.aspect === aspect);

      if (!capability) {
        return false;
      }

      if (
        requirements?.minimumQuality !== undefined &&
        capability.quality < requirements.minimumQuality
      ) {
        return false;
      }

      if (
        requirements?.minimumContextWindow !== undefined &&
        capability.contextWindow < requirements.minimumContextWindow
      ) {
        return false;
      }

      if (requirements?.localOnly && !capability.local) {
        return false;
      }

      if (
        requirements?.maximumLatencyMs !== undefined &&
        (capability.latencyMs === undefined ||
          capability.latencyMs > requirements.maximumLatencyMs)
      ) {
        return false;
      }

      return true;
    });

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

      return currentCapability.quality > bestCapability.quality
        ? current
        : best;
    });
  }
}
