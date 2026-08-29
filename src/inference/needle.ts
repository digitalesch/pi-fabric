import type { InferenceProvider } from './provider.js';
import type { InferenceRequest } from './request.js';
import type { InferenceResponse } from './response.js';

import { ChildProcessTransport } from '../transport/child-process.js';

export interface NeedleProviderOptions {
  python?: string;
  worker?: string;
}

export class NeedleProvider implements InferenceProvider {
  readonly id = 'needle';

  private readonly transport: ChildProcessTransport;

  constructor(options: NeedleProviderOptions = {}) {
    const python =
      options.python ??
      process.env.PI_FABRIC_NEEDLE_PYTHON ??
      '.needle-venv/bin/python';

    const worker =
      options.worker ??
      process.env.PI_FABRIC_NEEDLE_WORKER ??
      'src/worker/needle_worker.py';

    this.transport = new ChildProcessTransport(python, [worker]);
  }

  async execute(request: InferenceRequest): Promise<InferenceResponse> {
    return this.transport.send(request);
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
