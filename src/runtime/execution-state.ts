import type {
  TaskExecution,
  TaskExecutionStatus,
} from '../core/task-execution.js';
import type { Result } from '../core/result.js';
import type { Task } from '../core/task.js';

export class ExecutionState {
  private readonly executions = new Map<string, TaskExecution>();

  initialize(tasks: Task[]): void {
    for (const task of tasks) {
      if (this.executions.has(task.id)) {
        throw new Error(`Duplicate task ID: ${task.id}`);
      }

      this.executions.set(task.id, {
        taskId: task.id,
        status: 'pending',
      });
    }
  }

  start(taskId: string): void {
    const execution = this.get(taskId);

    this.transition(execution, 'running');

    execution.startedAt = Date.now();
  }

  complete(taskId: string, result: Result): void {
    const execution = this.get(taskId);

    this.transition(execution, 'completed');

    execution.result = result;
    execution.completedAt = Date.now();
  }

  fail(taskId: string, result: Result): void {
    const execution = this.get(taskId);

    this.transition(execution, 'failed');

    execution.result = result;
    execution.completedAt = Date.now();
  }

  block(taskId: string): void {
    const execution = this.get(taskId);

    this.transition(execution, 'blocked');

    execution.completedAt = Date.now();
  }

  get(taskId: string): TaskExecution {
    const execution = this.executions.get(taskId);

    if (!execution) {
      throw new Error(`Task execution not found: ${taskId}`);
    }

    return execution;
  }

  has(taskId: string): boolean {
    return this.executions.has(taskId);
  }

  all(): TaskExecution[] {
    return [...this.executions.values()];
  }

  private transition(
    execution: TaskExecution,
    status: TaskExecutionStatus,
  ): void {
    if (!this.isValidTransition(execution.status, status)) {
      throw new Error(
        `Invalid task execution transition: ${execution.status} -> ${status}`,
      );
    }

    execution.status = status;
  }

  private isValidTransition(
    from: TaskExecutionStatus,
    to: TaskExecutionStatus,
  ): boolean {
    if (from === 'pending') {
      return to === 'running' || to === 'blocked';
    }

    if (from === 'running') {
      return to === 'completed' || to === 'failed';
    }

    return false;
  }
}
