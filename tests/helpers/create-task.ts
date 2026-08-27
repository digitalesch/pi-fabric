import { Task } from '../../src/core/task.js';

export function createTask(id: string, dependencies: string[] = []): Task {
  return {
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
  };
}
