import { describe, expect, it } from 'vitest';

import { createFabric } from '../../src/index.js';
import { Objective } from '../../src/index.js';

describe('public API integration', () => {
  it('runs a complete fabric workflow', async () => {
    const fabric = createFabric();

    const objective: Objective = {
      description: 'Extract requirements from the input',
    };

    const result = await fabric.run(objective);

    expect(result).toBeDefined();
  });
});
