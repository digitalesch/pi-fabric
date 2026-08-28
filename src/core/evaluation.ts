export interface Evaluation {
  taskId: string;

  accepted: boolean;

  issues: string[];

  feedback?: {
    missing?: string[];

    suggestions?: string[];

    confidence?: number;
  };
}
