import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';

import { SchedulingPolicy } from '../runtime/scheduling-policy.js';
import { DefaultNodeScorer } from './default-node-scorer.js';

import { NodeScorer } from './node-scorer.js';

export class LoadAwarePolicy implements SchedulingPolicy {
  constructor(
    private readonly scorer: NodeScorer = new DefaultNodeScorer(0.5, 0.2, 0.3),
  ) {}

  select(
    nodes: ModelNode[],
    aspect: string,
    requirements?: ExecutionRequirements,
  ): ModelNode {
    if (nodes.length === 0) {
      throw new Error(`No node available for aspect: ${aspect}`);
    }

    const scored = nodes
      .map((node) =>
        this.scorer.score(node, {
          aspect,
          requirements,
        }),
      )
      .filter((candidate) => candidate.health > 0);

    if (scored.length === 0) {
      throw new Error(`No healthy node available for aspect: ${aspect}`);
    }

    return scored.reduce((best, current) =>
      current.score > best.score ? current : best,
    ).node;
  }
}
