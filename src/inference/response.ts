export interface InferenceResponse {
  success: boolean;

  output: unknown;

  metadata?: {
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
