import { NodeEligibility } from "../node-eligibility.js";
import { SchedulingPolicy } from "../scheduling-policy.js";
import { ModelNode } from "../../nodes/node.js";
import { ExecutionRequirements } from "../../core/execution-requirements.js";
import { SchedulingContext } from "../scheduling-context.js";

export class AdaptivePolicy implements SchedulingPolicy {
  constructor(
    private readonly eligibility = new NodeEligibility(),
    private readonly qualityWeight = 0.7,
    private readonly acceptanceWeight = 0.3,
  ) {
    if (
      qualityWeight < 0 ||
      acceptanceWeight < 0 ||
      qualityWeight + acceptanceWeight !== 1
    ) {
      throw new Error(
        'Scheduling weights must be non-negative and sum to 1',
      );
    }
  }

  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
    context?: SchedulingContext,
  ): ModelNode {
    const candidates = nodes.filter((node) =>
      this.eligibility.satisfies(
        node,
        aspect,
        requirements,
      ),
    );

    if (candidates.length === 0) {
      throw new Error(
        `No node satisfies requirements for aspect: ${aspect}`,
      );
    }

    return candidates.reduce((best, current) => {
      return this.score(current, aspect, context)
        > this.score(best, aspect, context)
        ? current
        : best;
    });
  }

  private score(
    node: ModelNode,
    aspect: string,
    context?: SchedulingContext,
  ): number {
    const capability = node
      .capabilities()
      .find(
        (capability) => capability.aspect === aspect,
      );

    if (!capability) {
      return Number.NEGATIVE_INFINITY;
    }

    const profile = context?.performance?.profile(
      node.nodeId,
      aspect,
    );

    if (!profile || profile.executions === 0) {
      return capability.quality;
    }

    const observedQuality =
      profile.averageQuality ??
      capability.quality;

    const observedAcceptance =
      profile.acceptanceRate ??
      1;

    const effectiveQuality =
      capability.quality *
        (1 - profile.confidence) +
      observedQuality *
        profile.confidence;

    return (
      effectiveQuality * this.qualityWeight +
      observedAcceptance * this.acceptanceWeight
    );
  }
}