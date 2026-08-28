import { ExecutionHistory } from './execution-history.js';
import { ExecutionInspector } from './execution-inspector.js';
import { ExecutionState } from './execution-state.js';

export type ExecutionRunStatus = 'created' | 'running' | 'completed' | 'failed';

export class ExecutionRun {
  readonly id: string;
  readonly state: ExecutionState;
  readonly history: ExecutionHistory;
  readonly inspector: ExecutionInspector;

  readonly createdAt: number;

  private _status: ExecutionRunStatus = 'created';
  private _startedAt?: number;
  private _completedAt?: number;

  constructor(id: string = crypto.randomUUID()) {
    this.id = id;
    this.createdAt = Date.now();

    this.state = new ExecutionState();
    this.history = new ExecutionHistory();

    this.inspector = new ExecutionInspector(this.state, this.history);
  }

  get status(): ExecutionRunStatus {
    return this._status;
  }

  get startedAt(): number | undefined {
    return this._startedAt;
  }

  get completedAt(): number | undefined {
    return this._completedAt;
  }

  start(): void {
    if (this._status !== 'created') {
      throw new Error(
        `Invalid execution run transition: ${this._status} -> running`,
      );
    }

    this._status = 'running';
    this._startedAt = Date.now();
  }

  complete(): void {
    if (this._status !== 'running') {
      throw new Error(
        `Invalid execution run transition: ${this._status} -> completed`,
      );
    }

    this._status = 'completed';
    this._completedAt = Date.now();
  }

  fail(): void {
    if (this._status !== 'running') {
      throw new Error(
        `Invalid execution run transition: ${this._status} -> failed`,
      );
    }

    this._status = 'failed';
    this._completedAt = Date.now();
  }

  get durationMs(): number | undefined {
    if (this._startedAt === undefined || this._completedAt === undefined) {
      return undefined;
    }

    return this._completedAt - this._startedAt;
  }
}
