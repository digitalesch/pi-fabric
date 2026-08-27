export interface Result {
  taskId: string;

  success: boolean;

  output: unknown;

  metadata: {
    nodeId: string;

    provider?: string;

    model?: string;

    latencyMs?: number;

    inputTokens?: number;

    outputTokens?: number;
  };

  error?: {
    code: string;
    message: string;
  };
}
