import { afterEach, describe, expect, it } from 'vitest';

import { extractRequirements } from '../../src/core/aspects/extract-requirements.js';
import { NeedleProvider } from '../../src/inference/needle.js';
import { InferenceNode } from '../../src/nodes/inference-node.js';
import { AspectRegistry } from '../../src/runtime/aspect-registry.js';
import { Executor } from '../../src/runtime/executor.js';
import { Fabric } from '../../src/runtime/fabric.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';
import { PlanValidator } from '../../src/runtime/plan-validator.js';
import { Planner } from '../../src/runtime/planner.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { BasicEvaluator } from '../../src/evaluation/basic.js';
import { FakeThinker } from '../../src/thinker/fake.js';
import { InProcessTransport } from '../../src/transport/in-process.js';

describe('Needle Fabric integration', () => {
  const providers: NeedleProvider[] = [];

  afterEach(async () => {
    for (const provider of providers) {
      await provider.close();
    }

    providers.length = 0;
  });

  it('runs an objective through the complete Fabric pipeline using Needle', async () => {
    const provider = new NeedleProvider();

    providers.push(provider);

    const transport = new InProcessTransport(provider);

    const nodeRegistry = new NodeRegistry();

    nodeRegistry.register(
      new InferenceNode(
        'needle-local',
        [
          {
            aspect: 'extract_requirements',
            quality: 0.95,
            contextWindow: 4096,
            local: true,
            latencyMs: 400,
          },
        ],
        transport,
      ),
    );

    const selector = new NodeSelector(new QualityFirstPolicy());

    const executor = new Executor(nodeRegistry, selector);

    const planExecutor = new PlanExecutor(executor);

    const planner = new Planner(nodeRegistry, selector);

    const aspectRegistry = new AspectRegistry();

    aspectRegistry.register(extractRequirements);

    const thinker = new FakeThinker();

    const planValidator = new PlanValidator();

    const evaluator = new BasicEvaluator();

    const fabric = new Fabric(
      thinker,
      planner,
      planExecutor,
      aspectRegistry,
      planValidator,
      evaluator,
    );

    const result = await fabric.run({
      description: 'Extract requirements for a CoreXY machine',
    });

    expect(result).toBeDefined();
    expect(result).not.toBe('');
  });
});
