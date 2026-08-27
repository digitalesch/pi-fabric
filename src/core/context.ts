export interface Context {
  facts: Record<string, unknown>;
  constraints: string[];
  assumptions: string[];
  references: string[];
}
