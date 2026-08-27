import { describe, expect, it } from 'vitest';

import { Executor } from '../../../src/runtime/executor.js';
import { NodeSelector } from '../../../src/runtime/node-selector.js';
import { NodeRegistry } from '../../../src/runtime/registry.js';
import { QualityFirstPolicy } from '../../../src/runtime/policies/quality-first.js';

import { createTask } from '../../helpers/create-task.js';
import { CountingFailingNode } from '../../helpers/counting-failing-node.js';

import { RecordingRetryPolicy } from '../../helpers/record-retry-policy.js';

describe('Executor retry behavior', () => {
  it('passes the current attempt number to the retry policy', async () => {
    const registry = new NodeRegistry();

    const node = new CountingFailingNode('node-1');

    registry.register(node);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const retryPolicy = new RecordingRetryPolicy(2);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.executeOn(createTask('task-1'), 'node-1');

    expect(result.success).toBe(false);
    expect(node.attempts).toBe(3);
    expect(retryPolicy.attempts).toEqual([1, 2, 3]);
  });
});
