import type { PhysicalPlan } from '../core/physical-plan.js';
import type { ModelNode } from '../nodes/node.js';
import type { NodeRegistry } from './registry.js';

export class PhysicalPlanValidator {
  constructor(private readonly nodeRegistry: NodeRegistry) {}

  validate(plan: PhysicalPlan): void {
    const taskIds = new Set<string>();

    for (const physicalTask of plan.tasks) {
      const { task, nodeId } = physicalTask;

      if (taskIds.has(task.id)) {
        throw new Error(`Physical plan contains duplicate task: ${task.id}`);
      }

      taskIds.add(task.id);

      const node = this.nodeRegistry.get(nodeId);

      if (!node) {
        throw new Error(`Physical plan references missing node: ${nodeId}`);
      }

      this.validateNodeCapability(task.aspect, node);
    }

    this.validateDependencies(plan);
  }

  private validateNodeCapability(aspect: string, node: ModelNode): void {
    const capability = node
      .capabilities()
      .find((capability) => capability.aspect === aspect);

    if (!capability) {
      throw new Error(`Node ${node.nodeId} does not support aspect: ${aspect}`);
    }
  }

  private validateDependencies(plan: PhysicalPlan): void {
    const taskIds = new Set(
      plan.tasks.map((physicalTask) => physicalTask.task.id),
    );

    for (const physicalTask of plan.tasks) {
      for (const dependency of physicalTask.task.dependencies) {
        if (!taskIds.has(dependency)) {
          throw new Error(
            `Physical plan task ${physicalTask.task.id} depends on missing task: ${dependency}`,
          );
        }
      }
    }
  }
}
