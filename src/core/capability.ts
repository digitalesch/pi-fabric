export interface Capability {
  aspect: string;

  quality: number;

  contextWindow: number;

  latencyMs?: number;

  local: boolean;
}
