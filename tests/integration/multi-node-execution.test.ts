import { describe, expect, it } from 'vitest';

import { FakeInferenceProvider } from '../../src/inference/fake.js';
import { NeedleProvider } from '../../src/inference/needle.js';
import { createFabric } from '../../src/create-fabric.js';

describe('Multi-node Fabric integration', () => {
  it('executes through a configured provider', async () => {
    const provider = new FakeInferenceProvider();

    const fabric = createFabric({
      providers: [provider],
    });

    const result = await fabric.run({
      description: 'Extract requirements for a CoreXY machine',
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');

    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      taskId: 'extract-requirements',
      success: true,
    });
  });

  it('executes through Needle', async () => {
    const provider = new NeedleProvider();

    const fabric = createFabric({
      providers: [provider],
    });

    const result = await fabric.run({
      description: 'Extract requirements for a CoreXY machine',
    });

    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      taskId: 'extract-requirements',
      success: true,
      metadata: {
        nodeId: 'needle-inference',
      },
    });

    await provider.close();
  });

  it('accepts multiple inference providers', async () => {
    const fakeProvider = new FakeInferenceProvider();
    const needleProvider = new NeedleProvider();

    const fabric = createFabric({
      providers: [fakeProvider, needleProvider],
    });

    const result = await fabric.run({
      description: 'Extract requirements for a CoreXY machine',
    });

    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      taskId: 'extract-requirements',
      success: true,
    });

    await needleProvider.close();
  });
});
