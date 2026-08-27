import { RetryPolicy } from '../../src/runtime/retry-policy.js';

export class RecordingRetryPolicy implements RetryPolicy {
  public attempts: number[] = [];

  constructor(private readonly maxRetries: number) {}

  shouldRetry(attempt: number): boolean {
    this.attempts.push(attempt);

    return attempt <= this.maxRetries;
  }
}
