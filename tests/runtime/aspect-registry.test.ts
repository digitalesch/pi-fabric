import { describe, expect, it } from 'vitest';

import { extractRequirements } from '../../src/core/aspects/extract-requirements.js';
import { LocalNode } from '../../src/nodes/local.js';
import { AspectRegistry } from '../../src/runtime/aspect-registry.js';
import { Executor } from '../../src/runtime/executor.js';
import { Fabric } from '../../src/runtime/fabric.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';
import { Planner } from '../../src/runtime/planner.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { FakeThinker } from '../../src/thinker/fake.js';
import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { PlanValidator } from '../../src/runtime/plan-validator.js';
import { BasicEvaluator } from '../../src/evaluation/basic.js';
import { PerformanceRegistry } from '../../src/runtime/performance-registry.js';

describe('Fabric', () => {
  it('plans and executes an objective', async () => {
    const aspectRegistry = new AspectRegistry();

    aspectRegistry.register(extractRequirements);

    const provider = new FakeInferenceProvider();

    const nodeRegistry = new NodeRegistry();

    nodeRegistry.register(
      new LocalNode(
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
      ),
    );

    const policy = new QualityFirstPolicy();

    const selector = new NodeSelector(policy);

    const planner = new Planner(nodeRegistry, selector);

    const executor = new Executor(
      nodeRegistry,
      new NodeSelector(new QualityFirstPolicy()),
    );

    const planExecutor = new PlanExecutor(executor);

    const thinker = new FakeThinker();

    const planValidator = new PlanValidator();

    const evaluator = new BasicEvaluator();

    const performanceRegistry = new PerformanceRegistry();
    const inferenceProviders = [provider];

    const fabric = new Fabric(
      thinker,
      planner,
      planExecutor,
      aspectRegistry,
      planValidator,
      evaluator,
      3,
      inferenceProviders,
      performanceRegistry,
    );

    const result = await fabric.run({
      description: 'Analyze a mechanical design and identify its requirements.',
    });

    expect(result).toContain('extract_requirements');
  });
});
