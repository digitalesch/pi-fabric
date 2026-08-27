import { extractRequirements } from './core/aspects/extract-requirements.js';

import { FakeInferenceProvider } from './inference/fake.js';

import { InferenceNode } from './nodes/inference-node.js';

import { AspectRegistry } from './runtime/aspect-registry.js';
import { Executor } from './runtime/executor.js';
import { Fabric } from './runtime/fabric.js';
import { NodeSelector } from './runtime/node-selector.js';
import { PlanExecutor } from './runtime/plan-executor.js';
import { QualityFirstPolicy } from './runtime/policies/quality-first.js';
import { NodeRegistry } from './runtime/registry.js';
import { Planner } from './runtime/planner.js';

import { FakeThinker } from './thinker/fake.js';

import { InProcessTransport } from './transport/in-process.js';
import { PlanValidator } from './runtime/plan-validator.js';
import { BasicEvaluator } from './evaluation/basic.js';

export function createFabric(): Fabric {
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
