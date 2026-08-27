export interface RetryPolicy {
  shouldRetry(attempt: number, error: unknown): boolean;
}
