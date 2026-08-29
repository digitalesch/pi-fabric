import { describe, expect, it } from 'vitest';

import { extractRequirements } from '../../src/core/aspects/extract-requirements.js';
import type { Objective } from '../../src/core/objective.js';
import { BasicEvaluator } from '../../src/evaluation/basic.js';
import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { InProcessTransport } from '../../src/transport/in-process.js';
import { InferenceNode } from '../../src/nodes/inference-node.js';
import { AspectRegistry } from '../../src/runtime/aspect-registry.js';
import { Executor } from '../../src/runtime/executor.js';
import { Fabric } from '../../src/runtime/fabric.js';
import { NodeSelector } from '../../src/runtime/node-selector.js';
import { PlanExecutor } from '../../src/runtime/plan-executor.js';
import { PlanValidator } from '../../src/runtime/plan-validator.js';
import { Planner } from '../../src/runtime/planner.js';
import { QualityFirstPolicy } from '../../src/runtime/policies/quality-first.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { FakeThinker } from '../../src/thinker/fake.js';

function createTestFabric(): Fabric {
  const aspectRegistry = new AspectRegistry();
  aspectRegistry.register(extractRequirements);

  const provider = new FakeInferenceProvider();
  const transport = new InProcessTransport(provider);

  const nodeRegistry = new NodeRegistry();

  nodeRegistry.register(
    new InferenceNode(
      'local-test',
      [
        {
          aspect: 'extract_requirements',
          quality: 0.8,
          contextWindow: 4096,
          local: true,
          latencyMs: 1,
        },
      ],
      transport,
    ),
  );

  const selector = new NodeSelector(new QualityFirstPolicy());
  const executor = new Executor(nodeRegistry, selector);
  const planExecutor = new PlanExecutor(executor);
  const planner = new Planner(nodeRegistry, selector);
  const thinker = new FakeThinker();
  const planValidator = new PlanValidator();
  const evaluator = new BasicEvaluator();

  return new Fabric(
    thinker,
    planner,
    planExecutor,
    aspectRegistry,
    planValidator,
    evaluator,
  );
}

describe('Fabric', () => {
  it('executes an objective through the full orchestration pipeline', async () => {
    const fabric = createTestFabric();

    const objective: Objective = {
      description: 'Extract requirements for a CoreXY machine',
    };

    const result = await fabric.run(objective);

    expect(result).toBeDefined();

    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      taskId: 'extract-requirements',
      success: true,
    });

    expect(parsed[0].output).toMatchObject({
      aspect: 'extract_requirements',
      inputReceived: {
        objective: 'Extract requirements for a CoreXY machine',
      },
    });
  });
});
