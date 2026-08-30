export interface PerformanceObservation {
  nodeId: string;
  aspect: string;
  success: boolean;
  latencyMs?: number;
  evaluation?: {
    accepted: boolean;
    score: number;
  };
  timestamp: number;
}