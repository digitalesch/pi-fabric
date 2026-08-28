import type { ExecutionRequirements } from '../core/execution-requirements.js';
import type { ModelNode } from '../nodes/node.js';

export interface NodeScoreContext {
  aspect: string;
  requirements?: ExecutionRequirements;
}

export interface NodeScore {
  node: ModelNode;
  score: number;
  quality: number;
  health: number;
  load: number;
}

export interface NodeScorer {
  score(node: ModelNode, context: NodeScoreContext): NodeScore;
}
