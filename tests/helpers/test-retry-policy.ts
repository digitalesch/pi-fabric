import { RetryPolicy } from '../../src/runtime/retry-policy.js';

export class TestRetryPolicy implements RetryPolicy {
  constructor(private readonly maxRetries: number) {}

  shouldRetry(attempt: number, _error: unknown): boolean {
    return attempt <= this.maxRetries;
  }
}
