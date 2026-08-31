import { describe, expect, it } from 'vitest';

import type {
  TaskExecution,
  TaskExecutionStatus,
} from '../../src/core/task-execution.js';

describe('TaskExecution', () => {
  it('supports pending execution', () => {
    const execution: TaskExecution = {
      taskId: 'task-1',
      status: 'pending',
    };

    expect(execution.taskId).toBe('task-1');
    expect(execution.status).toBe('pending');
  });

  it('supports running execution', () => {
    const execution: TaskExecution = {
      taskId: 'task-1',
      status: 'running',
      startedAt: Date.now(),
    };

    expect(execution.status).toBe('running');
    expect(execution.startedAt).toBeDefined();
  });

  it('supports completed execution with a result', () => {
    const execution: TaskExecution = {
      taskId: 'task-1',
      status: 'completed',
      result: {
        taskId: 'task-1',
        success: true,
        output: {
          value: 'result',
        },
        metadata: {
          nodeId: 'node-1',
        },
      },
      startedAt: 100,
      completedAt: 200,
    };

    expect(execution.status).toBe('completed');
    expect(execution.result?.success).toBe(true);
    expect(execution.result?.metadata.nodeId).toBe('node-1');
    expect(execution.completedAt).toBe(200);
  });

  it('supports failed execution with a result', () => {
    const execution: TaskExecution = {
      taskId: 'task-1',
      status: 'failed',
      result: {
        taskId: 'task-1',
        success: false,
        output: null,
        metadata: {
          nodeId: 'node-1',
        },
        error: {
          code: 'NODE_EXECUTION_FAILED',
          message: 'Task failed',
        },
      },
    };

    expect(execution.status).toBe('failed');
    expect(execution.result?.success).toBe(false);
    expect(execution.result?.metadata.nodeId).toBe('node-1');
  });

  it('supports blocked execution without a result', () => {
    const execution: TaskExecution = {
      taskId: 'task-2',
      status: 'blocked',
    };

    expect(execution.status).toBe('blocked');
    expect(execution.result).toBeUndefined();
  });

  it('supports every execution status', () => {
    const statuses: TaskExecutionStatus[] = [
      'pending',
      'running',
      'completed',
      'failed',
      'blocked',
    ];

    expect(statuses).toHaveLength(5);
  });
});
