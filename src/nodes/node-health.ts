export type NodeHealthStatus = 'healthy' | 'degraded' | 'unavailable';

export interface NodeHealth {
  status: NodeHealthStatus;
  latencyMs?: number;
  load?: number;
  lastError?: string;
}

export interface NodeHealthProvider {
  health(): NodeHealth;
}
