export interface PerformanceProfile {
  nodeId: string;
  aspect: string;

  executions: number;
  successes: number;

  successRate: number;
  acceptanceRate?: number;

  averageLatencyMs?: number;
  averageQuality?: number;

  confidence: number;
}