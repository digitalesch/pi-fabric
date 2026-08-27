import { describe, expect, it } from 'vitest';

import type { PhysicalPlan } from '../../src/core/physical-plan.js';
import { PhysicalPlanValidator } from '../../src/runtime/physical-plan-validator.js';
import { NodeRegistry } from '../../src/runtime/registry.js';
import { RecordingNode } from '../helpers/recording-node.js';

describe('PhysicalPlanValidator', () => {
  it('accepts a valid physical plan', () => {
    const registry = new NodeRegistry();

    const node = new RecordingNode('node-1');

    registry.register(node);

    const validator = new PhysicalPlanValidator(registry);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'node-1',
        },
      ],
    };

    expect(() => validator.validate(plan)).not.toThrow();
  });

  it('rejects a physical plan that references a missing node', () => {
    const registry = new NodeRegistry();

    const validator = new PhysicalPlanValidator(registry);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'missing-node',
        },
      ],
    };

    expect(() => validator.validate(plan)).toThrow(
      'Physical plan references missing node: missing-node',
    );
  });

  it('rejects a physical plan when the node does not support the task aspect', () => {
    const registry = new NodeRegistry();

    const node = new RecordingNode('node-1', {
      aspect: 'other-aspect',
      quality: 0.8,
      contextWindow: 8192,
      local: true,
    });

    registry.register(node);

    const validator = new PhysicalPlanValidator(registry);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
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
          },
          nodeId: 'node-1',
        },
      ],
    };

    expect(() => validator.validate(plan)).toThrow(
      'Node node-1 does not support aspect: extract_requirements',
    );
  });

  it('rejects a physical plan with duplicate task ids', () => {
    const registry = new NodeRegistry();

    const node = new RecordingNode('node-1');

    registry.register(node);

    const validator = new PhysicalPlanValidator(registry);

    const task = {
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
    };

    const plan: PhysicalPlan = {
      tasks: [
        {
          task,
          nodeId: 'node-1',
        },
        {
          task: {
            ...task,
          },
          nodeId: 'node-1',
        },
      ],
    };

    expect(() => validator.validate(plan)).toThrow(
      'Physical plan contains duplicate task: task-1',
    );
  });

  it('rejects a physical plan with a missing dependency', () => {
    const registry = new NodeRegistry();

    const node = new RecordingNode('node-1');

    registry.register(node);

    const validator = new PhysicalPlanValidator(registry);

    const plan: PhysicalPlan = {
      tasks: [
        {
          task: {
            id: 'task-2',
            aspect: 'extract_requirements',
            input: {},
            context: {
              facts: {},
              constraints: [],
              assumptions: [],
              references: [],
            },
            outputSchema: {},
            dependencies: ['task-1'],
          },
          nodeId: 'node-1',
        },
      ],
    };

    expect(() => validator.validate(plan)).toThrow(
      'Physical plan task task-2 depends on missing task: task-1',
    );
  });
});
