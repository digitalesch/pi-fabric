import * as readline from 'node:readline';

import { FakeInferenceProvider } from '../inference/fake.js';
import type { InferenceRequest } from '../inference/request.js';

const provider = new FakeInferenceProvider();

const input = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

input.on('line', async (line) => {
  let request: InferenceRequest | undefined;

  try {
    request = JSON.parse(line) as InferenceRequest;

    const response = await provider.execute(request);

    process.stdout.write(
      `${JSON.stringify({
        taskId: request.taskId,
        ...response,
      })}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        taskId: request?.taskId,

        success: false,

        output: null,

        error: {
          code: 'WORKER_ERROR',

          message: error instanceof Error ? error.message : String(error),
        },
      })}\n`,
    );
  }
});
