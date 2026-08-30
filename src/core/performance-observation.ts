export interface PerformanceObservation {
  provider: string;
  aspect: string;

  success: boolean;

  latencyMs?: number;

  evaluation?: {
    accepted: boolean;
    score?: number;
  };

  timestamp: number;
}
