import type { PhysicalPlan } from '../core/physical-plan.js';

export class PlanValidator {
  validate(plan: PhysicalPlan): void {
    const taskIds = new Set<string>();

    for (const physicalTask of plan.tasks) {
      const task = physicalTask.task;

      if (!task.id.trim()) {
        throw new Error('Task ID must not be empty');
      }

      if (!task.aspect.trim()) {
        throw new Error(`Task ${task.id} must have an aspect`);
      }

      if (taskIds.has(task.id)) {
        throw new Error(`Duplicate task ID: ${task.id}`);
      }

      taskIds.add(task.id);
    }

    for (const physicalTask of plan.tasks) {
      for (const dependency of physicalTask.task.dependencies) {
        if (!taskIds.has(dependency)) {
          throw new Error(
            `Task ${physicalTask.task.id} depends on missing task: ${dependency}`,
          );
        }

        if (dependency === physicalTask.task.id) {
          throw new Error(
            `Task ${physicalTask.task.id} cannot depend on itself`,
          );
        }
      }
    }

    this.validateCycles(plan);
  }

  private validateCycles(plan: PhysicalPlan): void {
    const dependencies = new Map<string, string[]>();

    for (const physicalTask of plan.tasks) {
      dependencies.set(physicalTask.task.id, physicalTask.task.dependencies);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (taskId: string): void => {
      if (visiting.has(taskId)) {
        throw new Error(`Dependency cycle detected involving task: ${taskId}`);
      }

      if (visited.has(taskId)) {
        return;
      }

      visiting.add(taskId);

      for (const dependency of dependencies.get(taskId) ?? []) {
        visit(dependency);
      }

      visiting.delete(taskId);
      visited.add(taskId);
    };

    for (const taskId of dependencies.keys()) {
      visit(taskId);
    }
  }
}
