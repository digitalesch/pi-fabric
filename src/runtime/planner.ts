import type { PhysicalPlan } from '../core/physical-plan.js';
import type { Plan } from '../core/plan.js';
import { NodeSelector } from './node-selector.js';
import { NodeRegistry } from './registry.js';

export class Planner {
  constructor(
    private readonly registry: NodeRegistry,
    private readonly selector: NodeSelector,
  ) {}

  plan(plan: Plan): PhysicalPlan {
    const tasks = plan.tasks.map((task) => {
      const nodes = this.registry.findFor(task.aspect);

      if (nodes.length === 0) {
        throw new Error(`No node available for aspect: ${task.aspect}`);
      }

      const node = this.selector.select(nodes, task.aspect, task.requirements);

      return {
        task,
        nodeId: node.id,
      };
    });

    return {
      tasks,
    };
  }
}
