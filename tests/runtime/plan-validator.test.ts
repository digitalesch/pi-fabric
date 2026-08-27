import { describe, expect, it } from 'vitest';

import type { PhysicalPlan } from '../../src/core/physical-plan.js';
import { PlanValidator } from '../../src/runtime/plan-validator.js';

function physicalTask(
  id: string,
  dependencies: string[] = [],
): PhysicalPlan['tasks'][number] {
  return {
    task: {
      id,
      aspect: 'extract_requirements',
      input: {},
      context: {
        facts: {},
        constraints: [],
        assumptions: [],
        references: [],
      },
      outputSchema: {},
      dependencies,
    },
    nodeId: 'node-1',
  };
}

describe('PlanValidator', () => {
  const validator = new PlanValidator();

  it('accepts a valid plan', () => {
    const plan: PhysicalPlan = {
      tasks: [physicalTask('task-1'), physicalTask('task-2', ['task-1'])],
    };

    expect(() => validator.validate(plan)).not.toThrow();
  });

  it('rejects duplicate task IDs', () => {
    const plan: PhysicalPlan = {
      tasks: [physicalTask('task-1'), physicalTask('task-1')],
    };

    expect(() => validator.validate(plan)).toThrow('Duplicate task ID: task-1');
  });

  it('rejects missing dependencies', () => {
    const plan: PhysicalPlan = {
      tasks: [physicalTask('task-1', ['missing-task'])],
    };

    expect(() => validator.validate(plan)).toThrow(
      'Task task-1 depends on missing task: missing-task',
    );
  });

  it('rejects self dependencies', () => {
    const plan: PhysicalPlan = {
      tasks: [physicalTask('task-1', ['task-1'])],
    };

    expect(() => validator.validate(plan)).toThrow(
      'Task task-1 cannot depend on itself',
    );
  });

  it('rejects dependency cycles', () => {
    const plan: PhysicalPlan = {
      tasks: [
        physicalTask('task-1', ['task-2']),
        physicalTask('task-2', ['task-1']),
      ],
    };

    expect(() => validator.validate(plan)).toThrow('Dependency cycle detected');
  });

  it('rejects empty task IDs', () => {
    const plan: PhysicalPlan = {
      tasks: [physicalTask('   ')],
    };

    expect(() => validator.validate(plan)).toThrow('Task ID must not be empty');
  });

  it('rejects empty aspects', () => {
    const task = physicalTask('task-1');
    task.task.aspect = '   ';

    const plan: PhysicalPlan = {
      tasks: [task],
    };

    expect(() => validator.validate(plan)).toThrow(
      'Task task-1 must have an aspect',
    );
  });
});
