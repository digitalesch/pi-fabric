import { describe, expect, it } from 'vitest';

import { LocalNode } from '../../src/nodes/local.js';
import { Executor } from '../../src/runtime/executor.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { createTask } from '../helpers/create-task.js';
import { SuccessfulNode } from '../helpers/successful-node.js';
import { FailingNode } from '../helpers/failing-node.js';
import { CountingFailingNode } from '../helpers/counting-failing-node.js';
import { TestRetryPolicy } from '../helpers/test-retry-policy.js';
import { RecordingRetryPolicy } from '../helpers/record-retry-policy.js';
import { FailThenSucceedNode } from '../helpers/fail-then-succeed-node.js';
import { InferenceNode } from '../../src/index.js';
import { Task } from '../../src/index.js';
import { InProcessTransport } from '../../src/transport/in-process.js';
import { PerformanceRegistry } from '../../src/runtime/performance-registry.js';

describe('Executor', () => {
  const task: Task = {
    id: 'task-1',
    aspect: 'extract_requirements',
    input: {
      document: 'CoreXY machine',
    },
    context: {
      facts: {},
      constraints: [],
      assumptions: [],
      references: [],
    },
    outputSchema: {
      type: 'object',
    },
    dependencies: [],
    requirements: {},
  };

  it('executes a task on the explicitly selected node', async () => {
    const registry = new NodeRegistry();

    const fakeNode = new InferenceNode(
      'fake-local',
      'fake',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.5,
          contextWindow: 4096,
          local: true,
          latencyMs: 1,
        },
      ],
      new InProcessTransport({
        id: 'fake',
        async execute() {
          return {
            success: true,
            output: {
              requirements: ['fake'],
            },
            metadata: {
              model: 'fake-model',
            },
          };
        },
      }),
    );

    registry.register(fakeNode);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const executor = new Executor(
      registry,
      selector,
      undefined,
      performanceRegistry,
    );

    const result = await executor.executeOn(task, 'fake-local');

    expect(result.success).toBe(true);
    expect(result.metadata.nodeId).toBe('fake-local');
    expect(result.metadata.provider).toBe('fake');

    const profile = performanceRegistry.profile(
      'fake-local',
      'extract_requirements',
    );

    expect(profile.executions).toBe(1);
    expect(profile.successRate).toBe(1);
  });

  it('selects a node when executing a logical task', async () => {
    const registry = new NodeRegistry();

    registry.register(
      new InferenceNode(
        'fake-local',
        'fake',
        [
          {
            aspect: 'extract_requirements',
            quality: 0.8,
            contextWindow: 4096,
            local: true,
            latencyMs: 1,
          },
        ],
        new InProcessTransport({
          id: 'fake',
          async execute() {
            return {
              success: true,
              output: {},
              metadata: {
                model: 'fake-model',
              },
            };
          },
        }),
      ),
    );

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const executor = new Executor(registry, selector);

    const result = await executor.execute(task);

    expect(result.success).toBe(true);
    expect(result.metadata.nodeId).toBe('fake-local');
  });

  it('returns the final failure when all nodes are exhausted', async () => {
    const registry = new NodeRegistry();

    const nodeA = new FailThenSucceedNode('node-a', 10);
    const nodeB = new FailThenSucceedNode('node-b', 10);

    registry.register(nodeA);
    registry.register(nodeB);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(2);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.execute(createTask('task-1'));

    expect(result.success).toBe(false);

    expect(nodeA.attempts).toBe(3);
    expect(nodeB.attempts).toBe(3);

    expect(result.metadata.nodeId).toBe('node-b');
  });

  it('retries a node before failing over to another node', async () => {
    const registry = new NodeRegistry();

    const nodeA = new CountingFailingNode('node-a');
    const nodeB = new SuccessfulNode('node-b');

    registry.register(nodeA);
    registry.register(nodeB);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(2);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.execute(createTask('task-1'));

    expect(result.success).toBe(true);
    expect(result.metadata.nodeId).toBe('node-b');

    expect(nodeA.attempts).toBe(3);
    expect(nodeB.attempts).toBe(1);

    expect(retryPolicy.attempts).toEqual([1, 2, 3]);
  });

  it('retries a node before failing over to another node', async () => {
    const registry = new NodeRegistry();

    const nodeA = new CountingFailingNode('node-a');
    const nodeB = new SuccessfulNode('node-b');

    registry.register(nodeA);
    registry.register(nodeB);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(2);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.execute(createTask('task-1'));

    expect(result.success).toBe(true);
    expect(result.metadata.nodeId).toBe('node-b');

    expect(nodeA.attempts).toBe(3);
    expect(nodeB.attempts).toBe(1);
  });

  it('fails over to another node after exhausting retries', async () => {
    const registry = new NodeRegistry();

    const nodeA = new CountingFailingNode('node-a');
    const nodeB = new SuccessfulNode('node-b');

    registry.register(nodeA);
    registry.register(nodeB);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(2);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.execute(createTask('task-1'));

    expect(result.success).toBe(true);
    expect(result.metadata.nodeId).toBe('node-b');

    expect(nodeA.attempts).toBe(3);
    expect(nodeB.attempts).toBe(1);
  });

  it('returns the final failure after retries are exhausted', async () => {
    const registry = new NodeRegistry();
    const node = new CountingFailingNode('node-1');

    registry.register(node);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(2);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.executeOn(createTask('task-1'), 'node-1');

    expect(result.success).toBe(false);
    expect(node.attempts).toBe(3);
    expect(result.error?.code).toBe('TEMPORARY_FAILURE');
  });

  it('retries thrown node errors', async () => {
    const registry = new NodeRegistry();
    const node = new FailingNode('node-1', 'temporary failure');

    registry.register(node);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(2);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.executeOn(createTask('task-1'), 'node-1');

    expect(result.success).toBe(false);
    expect(retryPolicy.attempts).toEqual([1, 2, 3]);
    expect(result.error?.code).toBe('NODE_EXECUTION_FAILED');
  });

  it('returns success when a retry eventually succeeds', async () => {
    const registry = new NodeRegistry();
    const node = new FailThenSucceedNode('node-1', 2);

    registry.register(node);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(2);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.executeOn(createTask('task-1'), 'node-1');

    expect(result.success).toBe(true);
    expect(result.output).toEqual({
      recovered: true,
    });

    expect(node.attempts).toBe(3);
    expect(retryPolicy.attempts).toEqual([1, 2]);
  });

  it('stops immediately when the retry policy rejects retry', async () => {
    const registry = new NodeRegistry();
    const node = new CountingFailingNode('node-1');

    registry.register(node);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(0);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.executeOn(createTask('task-1'), 'node-1');

    expect(result.success).toBe(false);
    expect(node.attempts).toBe(1);
    expect(retryPolicy.attempts).toEqual([1]);
  });

  it('does not retry a successful execution', async () => {
    const registry = new NodeRegistry();
    const node = new SuccessfulNode('node-1');

    registry.register(node);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const retryPolicy = new RecordingRetryPolicy(3);

    const executor = new Executor(registry, selector, retryPolicy);

    const result = await executor.executeOn(createTask('task-1'), 'node-1');

    expect(result.success).toBe(true);
    expect(node.attempts).toBe(1);
    expect(retryPolicy.attempts).toEqual([]);
  });

  it('executes only once when no retry policy is configured', async () => {
    const registry = new NodeRegistry();
    const node = new CountingFailingNode('node-1');

    registry.register(node);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const executor = new Executor(registry, selector);

    const result = await executor.executeOn(createTask('task-1'), 'node-1');

    expect(result.success).toBe(false);
    expect(node.attempts).toBe(1);
  });

  it('executes only once when no retry policy is configured', async () => {
    const registry = new NodeRegistry();
    const node = new CountingFailingNode('node-1');

    registry.register(node);

    const performanceRegistry = new PerformanceRegistry();

    const selector = new NodeSelector(
      new QualityFirstPolicy(),
      performanceRegistry,
    );

    const executor = new Executor(registry, selector);

    const result = await executor.executeOn(createTask('task-1'), 'node-1');

    expect(result.success).toBe(false);
    expect(node.attempts).toBe(1);
  });

  it('executes a task on a selected node', async () => {
    const provider = new FakeInferenceProvider();

    const registry = new NodeRegistry();

    const node = new LocalNode(
      'local-test',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.85,
          contextWindow: 8192,
          latencyMs: 100,
          local: true,
        },
      ],
      provider,
    );

    registry.register(node);

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const result = await executor.executeOn(
      {
        id: 'task-1',
        aspect: 'extract_requirements',
        input: {
          document: 'test document',
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
      },
      'local-test',
    );

    expect(result.success).toBe(true);
    expect(result.metadata?.nodeId).toBe('local-test');
  });

  it('converts node execution failures into failed results', async () => {
    const registry = new NodeRegistry();

    registry.register(new FailingNode('failing-node', 'model unavailable'));

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const result = await executor.execute({
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
    });

    expect(result.success).toBe(false);

    expect(result.taskId).toBe('task-1');

    expect(result.metadata.nodeId).toBe('failing-node');

    expect(result.error).toEqual({
      code: 'NODE_EXECUTION_FAILED',
      message: 'model unavailable',
    });
  });

  it('retries failed node execution', async () => {
    const registry = new NodeRegistry();

    const node = new CountingFailingNode('failing-node');

    registry.register(node);

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
      new TestRetryPolicy(2),
    );

    const result = await executor.execute({
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
    });

    expect(result.success).toBe(false);
    expect(node.attempts).toBe(3);
  });

  it('falls back to another capable node after failure', async () => {
    const registry = new NodeRegistry();

    const failing = new FailingNode('primary-node', 'primary unavailable');

    const fallback = new SuccessfulNode('fallback-node');

    registry.register(failing);
    registry.register(fallback);

    const executor = new Executor(
      registry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const result = await executor.execute({
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
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.nodeId).toBe('fallback-node');
    expect(fallback.attempts).toBe(1);
  });
});
