import type { ExecutionRequirements } from '../../core/execution-requirements.js';
import type { ModelNode } from '../../nodes/node.js';
import { NodeEligibility } from '../node-eligibility.js';
import type { SchedulingContext } from '../scheduling-context.js';
import type { SchedulingPolicy } from '../scheduling-policy.js';

export class QualityFirstPolicy implements SchedulingPolicy {
  constructor(
    private readonly eligibility = new NodeEligibility(),
  ) {}

  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
    _context?: SchedulingContext,
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
      .find(
        (capability) => capability.aspect === aspect,
      );

    return capability?.quality ?? Number.NEGATIVE_INFINITY;
  }
}