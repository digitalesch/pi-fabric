import { describe, expect, it } from 'vitest';

import { ExecutionRun } from '../../src/runtime/execution-run.js';

describe('ExecutionRun', () => {
  it('creates a run with a unique ID', () => {
    const run = new ExecutionRun();

    expect(run.id).toBeDefined();
    expect(run.id).toEqual(expect.any(String));
    expect(run.id.length).toBeGreaterThan(0);
  });

  it('accepts an explicit ID', () => {
    const run = new ExecutionRun('run-1');

    expect(run.id).toBe('run-1');
  });

  it('starts in the created state', () => {
    const run = new ExecutionRun('run-1');

    expect(run.status).toBe('created');
    expect(run.startedAt).toBeUndefined();
    expect(run.completedAt).toBeUndefined();
    expect(run.durationMs).toBeUndefined();
  });

  it('records its creation time', () => {
    const before = Date.now();

    const run = new ExecutionRun('run-1');

    const after = Date.now();

    expect(run.createdAt).toBeGreaterThanOrEqual(before);
    expect(run.createdAt).toBeLessThanOrEqual(after);
  });

  it('starts a created run', () => {
    const run = new ExecutionRun('run-1');

    run.start();

    expect(run.status).toBe('running');
    expect(run.startedAt).toBeDefined();
    expect(run.completedAt).toBeUndefined();
  });

  it('records a valid start timestamp', () => {
    const before = Date.now();

    const run = new ExecutionRun('run-1');
    run.start();

    const after = Date.now();

    expect(run.startedAt).toBeGreaterThanOrEqual(before);
    expect(run.startedAt).toBeLessThanOrEqual(after);
  });

  it('completes a running run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.complete();

    expect(run.status).toBe('completed');
    expect(run.startedAt).toBeDefined();
    expect(run.completedAt).toBeDefined();
  });

  it('records a valid completion timestamp', () => {
    const before = Date.now();

    const run = new ExecutionRun('run-1');
    run.start();
    run.complete();

    const after = Date.now();

    expect(run.completedAt).toBeGreaterThanOrEqual(before);
    expect(run.completedAt).toBeLessThanOrEqual(after);
  });

  it('calculates duration for a completed run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.complete();

    expect(run.durationMs).toBeDefined();
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.durationMs).toBe(run.completedAt! - run.startedAt!);
  });

  it('fails a running run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.fail();

    expect(run.status).toBe('failed');
    expect(run.startedAt).toBeDefined();
    expect(run.completedAt).toBeDefined();
  });

  it('calculates duration for a failed run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.fail();

    expect(run.durationMs).toBeDefined();
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.durationMs).toBe(run.completedAt! - run.startedAt!);
  });

  it('does not expose a duration before the run finishes', () => {
    const run = new ExecutionRun('run-1');

    expect(run.durationMs).toBeUndefined();

    run.start();

    expect(run.durationMs).toBeUndefined();
  });

  it('rejects starting an already running run', () => {
    const run = new ExecutionRun('run-1');

    run.start();

    expect(() => run.start()).toThrow(
      'Invalid execution run transition: running -> running',
    );
  });

  it('rejects starting a completed run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.complete();

    expect(() => run.start()).toThrow(
      'Invalid execution run transition: completed -> running',
    );
  });

  it('rejects starting a failed run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.fail();

    expect(() => run.start()).toThrow(
      'Invalid execution run transition: failed -> running',
    );
  });

  it('rejects completing a created run', () => {
    const run = new ExecutionRun('run-1');

    expect(() => run.complete()).toThrow(
      'Invalid execution run transition: created -> completed',
    );
  });

  it('rejects failing a created run', () => {
    const run = new ExecutionRun('run-1');

    expect(() => run.fail()).toThrow(
      'Invalid execution run transition: created -> failed',
    );
  });

  it('rejects completing an already completed run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.complete();

    expect(() => run.complete()).toThrow(
      'Invalid execution run transition: completed -> completed',
    );
  });

  it('rejects failing an already failed run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.fail();

    expect(() => run.fail()).toThrow(
      'Invalid execution run transition: failed -> failed',
    );
  });

  it('rejects failing a completed run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.complete();

    expect(() => run.fail()).toThrow(
      'Invalid execution run transition: completed -> failed',
    );
  });

  it('rejects completing a failed run', () => {
    const run = new ExecutionRun('run-1');

    run.start();
    run.fail();

    expect(() => run.complete()).toThrow(
      'Invalid execution run transition: failed -> completed',
    );
  });

  it('creates execution state for the run', () => {
    const run = new ExecutionRun('run-1');

    expect(run.state).toBeDefined();
  });

  it('creates execution history for the run', () => {
    const run = new ExecutionRun('run-1');

    expect(run.history).toBeDefined();
  });

  it('creates an inspector for the run', () => {
    const run = new ExecutionRun('run-1');

    expect(run.inspector).toBeDefined();
  });

  it('shares state with the inspector', () => {
    const run = new ExecutionRun('run-1');

    expect(run.inspector.snapshot()).toEqual(run.state.snapshot());
  });

  it('shares history with the inspector', () => {
    const run = new ExecutionRun('run-1');

    run.history.record({
      type: 'task_started',
      taskId: 'task-1',
      nodeId: 'node-1',
      attempt: 1,
    });

    expect(run.inspector.timeline()).toMatchObject([
      {
        type: 'task_started',
        taskId: 'task-1',
        nodeId: 'node-1',
        attempt: 1,
      },
    ]);
  });

  it('keeps state and history independent', () => {
    const run = new ExecutionRun('run-1');

    expect(run.state).not.toBe(run.history);

    expect(run.state).not.toBe(run.inspector);

    expect(run.history).not.toBe(run.inspector);
  });
});
