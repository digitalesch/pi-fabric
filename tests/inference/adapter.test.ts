import { describe, expect, it } from 'vitest';

import {
  responseToResult,
  taskToRequest,
} from '../../src/inference/adapter.js';

describe('Inference adapter', () => {
  it('converts a task into an inference request', () => {
    const task = {
      id: 'task-1',

      aspect: 'extract_requirements',

      input: {
        design: 'CoreXY',
      },

      context: {
        facts: {},
        constraints: [],
        assumptions: [],
        references: [],
      },

      outputSchema: {
        requirements: 'string[]',
      },

      dependencies: [],
    };

    const request = taskToRequest(task);

    expect(request).toEqual({
      taskId: 'task-1',
      aspect: 'extract_requirements',
      input: task.input,
      context: task.context,
      outputSchema: task.outputSchema,
    });
  });

  it('converts an inference response into a result', () => {
    const task = {
      id: 'task-1',

      aspect: 'extract_requirements',

      input: {},

      context: {
        facts: {},
        constraints: [],
        assumptions: [],
        references: [],
      },

      outputSchema: {},

      dependencies: [],
    };

    const result = responseToResult(task, {
      success: true,

      output: {
        requirements: ['400mm bed'],
      },

      metadata: {
        model: 'test-model',
        latencyMs: 42,
        inputTokens: 100,
        outputTokens: 20,
      },
    });

    expect(result.taskId).toBe('task-1');

    expect(result.success).toBe(true);

    expect(result.output).toEqual({
      requirements: ['400mm bed'],
    });

    expect(result.metadata.model).toBe('test-model');

    expect(result.metadata.latencyMs).toBe(42);

    expect(result.metadata.inputTokens).toBe(100);

    expect(result.metadata.outputTokens).toBe(20);
  });
});
