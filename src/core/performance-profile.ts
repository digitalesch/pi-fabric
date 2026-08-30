export interface PerformanceProfile {
  provider: string;
  aspect: string;

  executions: number;
  successes: number;

  successRate: number;

  averageLatencyMs?: number;
  averageQuality?: number;

  confidence: number;
}
