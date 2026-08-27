import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';

export class NodeEligibility {
  satisfies(
    node: ModelNode,
    aspect: string,
    requirements?: ExecutionRequirements,
  ): boolean {
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
  }
}
