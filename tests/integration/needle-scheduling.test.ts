import { afterEach, describe, expect, it } from 'vitest';

import { extractRequirements } from '../../src/core/aspects/extract-requirements.js';
import { NeedleProvider } from '../../src/inference/needle.js';
import { InferenceNode } from '../../src/nodes/inference-node.js';
import { InProcessTransport } from '../../src/transport/in-process.js';
import { AspectRegistry } from '../../src/runtime/aspect-registry.js';
import { Executor } from '../../src/runtime/executor.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { PerformanceRegistry } from '../../src/runtime/performance-registry.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { Planner } from '../../src/runtime/planner.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';

describe('Needle scheduling integration', () => {
  const providers: NeedleProvider[] = [];

  afterEach(async () => {
    for (const provider of providers) {
      await provider.close();
    }

    providers.length = 0;
  });

  it('selects Needle as the highest-quality eligible node', async () => {
    const provider = new NeedleProvider();
    providers.push(provider);

    const needleNode = new InferenceNode(
      'needle-local',
      'needle',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.95,
          contextWindow: 4096,
          local: true,
          latencyMs: 400,
        },
      ],
      new InProcessTransport(provider),
    );

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
        async execute(request) {
          return {
            success: true,
            output: {
              requirements: ['fake'],
            },
            metadata: {
              model: 'fake',
            },
          };
        },
      }),
    );

    const registry = new NodeRegistry();

    registry.register(fakeNode);
    registry.register(needleNode);

    const selector = new NodeSelector(new QualityFirstPolicy());

    const performanceRegistry = new PerformanceRegistry();

    const planner = new Planner(registry, selector);

    const executor = new Executor(
      registry,
      selector,
      undefined,
      performanceRegistry,
    );

    const planExecutor = new PlanExecutor(executor);

    const aspectRegistry = new AspectRegistry();
    aspectRegistry.register(extractRequirements);

    const plan = {
      tasks: [
        {
          id: 'needle-scheduled-task',
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
          outputSchema: extractRequirements.outputSchema,
          dependencies: [],
          requirements: {
            minimumQuality: 0.9,
          },
        },
      ],
    };

    const physicalPlan = planner.plan(plan);

    expect(physicalPlan.tasks[0].nodeId).toBe('needle-local');

    const results = await planExecutor.execute(physicalPlan);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].metadata?.nodeId).toBe('needle-local');
    expect(results[0].metadata?.model).toBe('needle');

    const profile = performanceRegistry.profile(
      'needle-local',
      'extract_requirements',
    );

    expect(profile.executions).toBe(1);
    expect(profile.successRate).toBe(1);
  });
});
