import { spawn } from 'node:child_process';
import * as readline from 'node:readline';

import type { InferenceRequest } from '../inference/request.js';
import type { InferenceResponse } from '../inference/response.js';
import type { Transport } from './transport.js';
import type { WorkerResponse } from './message.js';

type PendingRequest = {
  resolve: (response: InferenceResponse) => void;
  reject: (error: Error) => void;
};

type WorkerMessage = WorkerResponse;

export class ChildProcessTransport implements Transport {
  private readonly process;

  private readonly output;

  private readonly pending = new Map<string, PendingRequest>();

  constructor(command: string, args: string[] = []) {
    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.output = readline.createInterface({
      input: this.process.stdout,
      terminal: false,
    });

    this.output.on('line', (line) => {
      this.handleMessage(line);
    });

    this.process.on('error', (error) => {
      this.rejectAll(error);
    });

    this.process.on('exit', (code, signal) => {
      const error = new Error(
        `Worker exited unexpectedly (code=${code}, signal=${signal})`,
      );

      this.rejectAll(error);
    });
  }

  async send(request: InferenceRequest): Promise<InferenceResponse> {
    if (this.process.stdin.destroyed) {
      throw new Error('Worker stdin is closed');
    }

    return new Promise((resolve, reject) => {
      this.pending.set(request.taskId, {
        resolve,
        reject,
      });

      this.process.stdin.write(`${JSON.stringify(request)}\n`);
    });
  }

  async close(): Promise<void> {
    this.output.close();

    if (!this.process.killed) {
      this.process.kill();
    }

    this.rejectAll(new Error('Transport closed'));
  }

  private handleMessage(line: string): void {
    let message: WorkerMessage;

    try {
      message = JSON.parse(line) as WorkerMessage;
    } catch {
      return;
    }

    if (!message.taskId) {
      return;
    }

    const pending = this.pending.get(message.taskId);

    if (!pending) {
      return;
    }

    this.pending.delete(message.taskId);

    const { taskId: _taskId, ...response } = message;

    pending.resolve(response);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }

    this.pending.clear();
  }
}
