export interface NodeScore {
  nodeId: string;
  provider: string;
  quality: number;
  latencyMs?: number;
  successRate?: number;
  confidence: number;
  score: number;
}