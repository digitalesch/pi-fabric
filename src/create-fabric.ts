import { extractRequirements } from './core/aspects/extract-requirements.js';

import { FakeInferenceProvider } from './inference/fake.js';
import { NeedleProvider } from './inference/needle.js';
import type { InferenceProvider } from './inference/provider.js';

import { InferenceNode } from './nodes/inference-node.js';

import { AspectRegistry } from './runtime/aspect-registry.js';
import { Executor } from './runtime/executor.js';
import { Fabric } from './runtime/fabric.js';
import { NodeSelector } from './runtime/node-selector.js';
import { PlanExecutor } from './runtime/plan-executor.js';
import { PlanValidator } from './runtime/plan-validator.js';
import { Planner } from './runtime/planner.js';
import { QualityFirstPolicy } from './runtime/policies/quality-first.js';
import { NodeRegistry } from './runtime/registry.js';

import { BasicEvaluator } from './evaluation/basic.js';
import { FakeThinker } from './thinker/fake.js';

import { InProcessTransport } from './transport/in-process.js';
import { PerformanceRegistry } from './runtime/performance-registry.js';

export interface FabricOptions {
  providers?: InferenceProvider[];
}

export function createInferenceNode(
  provider: InferenceProvider,
): InferenceNode {
  return new InferenceNode(
  `${provider.id}-inference`,
  provider.id,
  [
    {
      aspect: 'extract_requirements',
      quality: provider.id === 'needle' ? 0.95 : 0.8,
      contextWindow: 4096,
      local: true,
      latencyMs: provider.id === 'needle' ? 400 : 1,
    },
  ],
  new InProcessTransport(provider),
);
}

export function createFabric(options: FabricOptions = {}): Fabric {
  const aspectRegistry = new AspectRegistry();

  aspectRegistry.register(extractRequirements);

  const providers = options.providers ?? [new FakeInferenceProvider()];

  const nodeRegistry = new NodeRegistry();

  for (const provider of providers) {
    nodeRegistry.register(createInferenceNode(provider));
  }

  const performanceRegistry = new PerformanceRegistry();

  const selector = new NodeSelector(new QualityFirstPolicy());

  const executor = new Executor(
    nodeRegistry,
    selector,
    undefined,
    performanceRegistry,
  );

  const planExecutor = new PlanExecutor(executor);

  const planner = new Planner(nodeRegistry, selector);

  const thinker = new FakeThinker();

  const planValidator = new PlanValidator();

  const evaluator = new BasicEvaluator();

  const maxAttempts = 3;

  return new Fabric(
    thinker,
    planner,
    planExecutor,
    aspectRegistry,
    planValidator,
    evaluator,
    maxAttempts,
    providers,
    performanceRegistry,
  );
}
