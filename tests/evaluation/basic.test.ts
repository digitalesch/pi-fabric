import { describe, expect, it } from 'vitest';

import { BasicEvaluator } from '../../src/evaluation/basic.js';

describe('BasicEvaluator', () => {
  const evaluator = new BasicEvaluator();

  it('accepts a successful result with output', async () => {
    const evaluation = await evaluator.evaluate({
      taskId: 'task-1',
      success: true,
      output: {
        requirements: ['requirement-1'],
      },
      metadata: {
        nodeId: 'node-1',
      },
    });

    expect(evaluation).toEqual({
      taskId: 'task-1',
      accepted: true,
      issues: [],
      feedback: {
        confidence: 1,
      },
    });
  });

  it('rejects failed results', async () => {
    const evaluation = await evaluator.evaluate({
      taskId: 'task-1',
      success: false,
      output: null,
      metadata: {
        nodeId: 'node-1',
      },
      error: {
        code: 'NODE_EXECUTION_FAILED',
        message: 'model unavailable',
      },
    });

    expect(evaluation).toEqual({
      taskId: 'task-1',
      accepted: false,
      issues: ['model unavailable'],
      feedback: {
        confidence: 1,
      },
    });
  });

  it('rejects successful results without output', async () => {
    const evaluation = await evaluator.evaluate({
      taskId: 'task-1',
      success: true,
      output: null,
      metadata: {
        nodeId: 'node-1',
      },
    });

    expect(evaluation).toEqual({
      taskId: 'task-1',
      accepted: false,
      issues: ['Task produced no output'],
      feedback: {
        confidence: 1,
      },
    });
  });
});
