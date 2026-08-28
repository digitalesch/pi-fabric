import type { ModelNode } from '../nodes/node.js';
import type { NodeHealthProvider } from '../nodes/node-health.js';

import {
  type NodeScore,
  type NodeScoreContext,
  type NodeScorer,
} from './node-scorer.js';

export class DefaultNodeScorer implements NodeScorer {
  constructor(
    private readonly qualityWeight = 0.7,
    private readonly healthWeight = 0.2,
    private readonly loadWeight = 0.1,
  ) {
    const total = qualityWeight + healthWeight + loadWeight;

    if (total <= 0) {
      throw new Error('Node scorer weights must have a positive total');
    }
  }

  score(node: ModelNode, context: NodeScoreContext): NodeScore {
    const capability = node
      .capabilities()
      .find((candidate) => candidate.aspect === context.aspect);

    const quality = capability?.quality ?? 0;

    const health = this.healthOf(node);

    const healthScore =
      health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0.5 : 0;

    const load =
      health.load === undefined ? 0 : Math.min(1, Math.max(0, health.load));

    const score =
      quality * this.qualityWeight +
      healthScore * this.healthWeight +
      (1 - load) * this.loadWeight;

    return {
      node,
      score,
      quality,
      health: healthScore,
      load,
    };
  }

  private healthOf(node: ModelNode) {
    if (this.isHealthProvider(node)) {
      return (
        node.health() ?? {
          status: 'healthy' as const,
          load: 0,
        }
      );
    }

    return {
      status: 'healthy' as const,
      load: 0,
    };
  }
  private isHealthProvider(
    node: ModelNode,
  ): node is ModelNode & NodeHealthProvider {
    return typeof (node as Partial<NodeHealthProvider>).health === 'function';
  }
}
