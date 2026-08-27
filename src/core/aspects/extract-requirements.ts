import type { Aspect } from '../aspect.js';

export const extractRequirements: Aspect = {
  name: 'extract_requirements',

  description: 'Extract explicit requirements from the supplied material.',

  inputSchema: {
    type: 'object',
    required: ['document'],
    properties: {
      document: {
        type: 'string',
      },
    },
  },

  outputSchema: {
    type: 'object',
    required: ['requirements'],
    properties: {
      requirements: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
  },
};
