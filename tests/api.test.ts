import { describe, expect, it } from 'vitest';

import {
  AspectRegistry,
  DeterministicNode,
  Executor,
  Fabric,
  HealthAwarePolicy,
  InferenceNode,
  LoadAwarePolicy,
  NodeRegistry,
  NodeSelector,
  PlanExecutor,
  Planner,
  QualityFirstPolicy,
  createFabric,
} from '../src/index.js';

describe('public API', () => {
  it('exports the runtime API', () => {
    expect(createFabric).toBeTypeOf('function');

    expect(Fabric).toBeTypeOf('function');
    expect(Planner).toBeTypeOf('function');
    expect(Executor).toBeTypeOf('function');
    expect(PlanExecutor).toBeTypeOf('function');

    expect(NodeRegistry).toBeTypeOf('function');
    expect(NodeSelector).toBeTypeOf('function');
    expect(AspectRegistry).toBeTypeOf('function');

    expect(QualityFirstPolicy).toBeTypeOf('function');
    expect(HealthAwarePolicy).toBeTypeOf('function');
    expect(LoadAwarePolicy).toBeTypeOf('function');

    expect(DeterministicNode).toBeTypeOf('function');
    expect(InferenceNode).toBeTypeOf('function');
  });
});

describe('consumer usage', () => {
  it('can create and run a Fabric through the public API', async () => {
    const fabric = createFabric();

    const result = await fabric.run({
      description: 'Extract requirements for a CoreXY machine',
    });

    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
