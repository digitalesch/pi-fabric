export interface ExecutionRequirements {
  minimumQuality?: number;

  minimumContextWindow?: number;

  localOnly?: boolean;

  maximumLatencyMs?: number;
}
