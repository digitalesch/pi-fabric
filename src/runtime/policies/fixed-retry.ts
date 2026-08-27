import type { RetryPolicy } from '../retry-policy.js';

export class FixedRetryPolicy implements RetryPolicy {
  constructor(private readonly maxRetries: number) {
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new Error('maxRetries must be a non-negative integer');
    }
  }

  shouldRetry(attempt: number, _error: unknown): boolean {
    return attempt < this.maxRetries;
  }
}
