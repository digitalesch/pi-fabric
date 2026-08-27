import { describe, expect, it } from 'vitest';

import { LocalNode } from '../../src/nodes/local.js';
import { Executor } from '../../src/runtime/executor.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { ModelNode } from '../../src/nodes/node.js';
import { Capability } from '../../src/core/capability.js';
import { Result } from '../../src/core/result.js';
import { Task } from '../../src/core/task.js';
import { RetryPolicy } from '../../src/runtime/retry-policy.js';

class SuccessfulNode implements ModelNode {
  public attempts = 0;

  constructor(public readonly id: string) {}

  capabilities(): Capability[] {
    return [
      {
        aspect: 'extract_requirements',
        quality: 0.8,
        contextWindow: 8192,
        local: true,
      },
    ];
  }

  async execute(task: Task): Promise<Result> {
    this.attempts++;

    return {
      taskId: task.id,
      success: true,
      output: {
        executedBy: this.id,
      },
      metadata: {
        nodeId: this.id,
      },
    };
  }
}

class FailingNode implements ModelNode {
  constructor(
    public readonly id: string,
    private readonly error: string,
  ) {}

  capabilities(): Capability[] {
    return [
      {
        aspect: 'extract_requirements',
        quality: 0.9,
        contextWindow: 8192,
        local: true,
      },
    ];
  }

  async execute(_task: Task): Promise<Result> {
    throw new Error(this.error);
  }
}

class CountingFailingNode implements ModelNode {
  public attempts = 0;

  constructor(public readonly id: string) {}

  capabilities(): Capability[] {
    return [
      {
        aspect: 'extract_requirements',
        quality: 0.9,
        contextWindow: 8192,
        local: true,
      },
    ];
  }

  async execute(_task: Task): Promise<Result> {
    this.attempts++;

    throw new Error('temporary failure');
  }
}

class TestRetryPolicy implements RetryPolicy {
  constructor(private readonly maxRetries: number) {}

  shouldRetry(attempt: number, _error: unknown): boolean {
    return attempt <= this.maxRetries;
  }
}

describe('Executor', () => {
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
