import type { Task } from '../core/task.js';

export class TaskGraph {
  private readonly tasks = new Map<string, Task>();
  private readonly dependentTasks = new Map<string, Set<string>>();

  constructor(tasks: Task[]) {
    for (const task of tasks) {
      if (this.tasks.has(task.id)) {
        throw new Error(`Duplicate task ID: ${task.id}`);
      }

      this.tasks.set(task.id, task);
      this.dependentTasks.set(task.id, new Set());
    }

    for (const task of tasks) {
      const dependencies = new Set<string>();

      for (const dependency of task.dependencies) {
        if (dependencies.has(dependency)) {
          throw new Error(
            `Task ${task.id} has duplicate dependency: ${dependency}`,
          );
        }

        dependencies.add(dependency);

        if (!this.tasks.has(dependency)) {
          throw new Error(
            `Task ${task.id} depends on missing task: ${dependency}`,
          );
        }

        this.dependentTasks.get(dependency)!.add(task.id);
      }
    }

    this.validateCycles();
  }

  get(taskId: string): Task {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return task;
  }

  has(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  all(): Task[] {
    return [...this.tasks.values()];
  }

  dependencies(taskId: string): string[] {
    return [...this.get(taskId).dependencies];
  }

  dependents(taskId: string): string[] {
    return [...(this.dependentTasks.get(taskId) ?? [])];
  }

  roots(): Task[] {
    return this.all().filter((task) => task.dependencies.length === 0);
  }

  ready(completed: Set<string>): Task[] {
    return this.all().filter(
      (task) =>
        !completed.has(task.id) &&
        task.dependencies.every((dependency) => completed.has(dependency)),
    );
  }

  topologicalOrder(): Task[] {
    const completed = new Set<string>();
    const ordered: Task[] = [];

    while (ordered.length < this.tasks.size) {
      const ready = this.ready(completed);

      if (ready.length === 0) {
        throw new Error(
          'Unable to resolve task dependencies. Possible cycle or missing dependency.',
        );
      }

      for (const task of ready) {
        completed.add(task.id);
        ordered.push(task);
      }
    }

    return ordered;
  }

  private validateCycles(): void {
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

      for (const dependency of this.dependencies(taskId)) {
        visit(dependency);
      }

      visiting.delete(taskId);
      visited.add(taskId);
    };

    for (const taskId of this.tasks.keys()) {
      visit(taskId);
    }
  }
}
