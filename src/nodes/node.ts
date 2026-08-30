import type { Capability } from '../core/capability.js';
import type { Result } from '../core/result.js';
import type { Task } from '../core/task.js';

export interface ModelNode {
  readonly nodeId: string;

  capabilities(): Capability[];

  execute(task: Task): Promise<Result>;
}
