import type { ModelNode } from '../nodes/node.js';

export class NodeRegistry {
  private readonly nodes = new Map<string, ModelNode>();

  register(node: ModelNode): void {
    this.nodes.set(node.nodeId, node);
  }

  get(nodeId: string): ModelNode | undefined {
    return this.nodes.get(nodeId);
  }

  findFor(aspect: string): ModelNode[] {
    return [...this.nodes.values()].filter((node) =>
      node.capabilities().some((capability) => capability.aspect === aspect),
    );
  }
}
