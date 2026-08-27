import type { Plan } from '../core/plan.js';
import type { PhysicalPlan } from '../core/physical-plan.js';
import type { NodeSelector } from './node-selector.js';
import type { NodeRegistry } from './registry.js';

export class Planner {
  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly selector: NodeSelector,
  ) {}

  plan(plan: Plan): PhysicalPlan {
    return {
      tasks: plan.tasks.map((task) => {
        const nodes = this.nodeRegistry.findFor(task.aspect);

        const node = this.selector.select(nodes, task.aspect);

        return {
          task,
          nodeId: node.id,
        };
      }),
    };
  }
}
