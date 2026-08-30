import { describe, expect, it } from 'vitest';

import type { PerformanceObservation } from '../../src/core/performance-observation.js';
import { PerformanceRegistry } from '../../src/runtime/performance-registry.js';

const createObservation = (
  overrides: Partial<PerformanceObservation> = {},
): PerformanceObservation => ({
  nodeId: 'needle-local',
  aspect: 'extract_requirements',
  success: true,
  timestamp: Date.now(),
  ...overrides,
});

describe('PerformanceRegistry', () => {
  it('records successful executions', () => {
    const registry = new PerformanceRegistry();

    registry.record(
      createObservation({
        latencyMs: 400,
      }),
    );

    const profile = registry.profile(
      'needle-local',
      'extract_requirements',
    );

    expect(profile.executions).toBe(1);
    expect(profile.successRate).toBe(1);
    expect(profile.averageLatencyMs).toBe(400);
  });

  it('records failed executions', () => {
    const registry = new PerformanceRegistry();

    registry.record(
      createObservation({
        success: false,
        latencyMs: 500,
      }),
    );

    const profile = registry.profile(
      'needle-local',
      'extract_requirements',
    );

    expect(profile.executions).toBe(1);
    expect(profile.successRate).toBe(0);
  });

  it('aggregates multiple executions', () => {
    const registry = new PerformanceRegistry();

    registry.record(
      createObservation({
        latencyMs: 400,
      }),
    );

    registry.record(
      createObservation({
        latencyMs: 600,
      }),
    );

    registry.record(
      createObservation({
        success: false,
        latencyMs: 800,
      }),
    );

    const profile = registry.profile(
      'needle-local',
      'extract_requirements',
    );

    expect(profile.executions).toBe(3);
    expect(profile.successRate).toBeCloseTo(2 / 3);
    expect(profile.averageLatencyMs).toBe(600);
  });

  it('records observations', () => {
    const registry = new PerformanceRegistry();

    registry.record(
      createObservation({
        latencyMs: 380,
        timestamp: 1000,
      }),
    );

    expect(registry.all()).toHaveLength(1);
  });

  it('returns observations for a node and aspect', () => {
    const registry = new PerformanceRegistry();

    registry.record(
      createObservation({
        latencyMs: 380,
        timestamp: 1000,
      }),
    );

    registry.record(
      createObservation({
        success: false,
        latencyMs: 420,
        timestamp: 2000,
      }),
    );

    registry.record(
      createObservation({
        nodeId: 'http-local',
        latencyMs: 800,
        timestamp: 3000,
      }),
    );

    const observations = registry.forNode(
      'needle-local',
      'extract_requirements',
    );

    expect(observations).toHaveLength(2);

    expect(
      observations.every(
        (observation) => observation.nodeId === 'needle-local',
      ),
    ).toBe(true);
  });

  it('builds a performance profile', () => {
    const registry = new PerformanceRegistry();

    registry.record(
      createObservation({
        latencyMs: 300,
        evaluation: {
          accepted: true,
          score: 0.9,
        },
        timestamp: 1000,
      }),
    );

    registry.record(
      createObservation({
        latencyMs: 500,
        evaluation: {
          accepted: true,
          score: 0.8,
        },
        timestamp: 2000,
      }),
    );

    registry.record(
      createObservation({
        success: false,
        latencyMs: 700,
        evaluation: {
          accepted: false,
          score: 0.2,
        },
        timestamp: 3000,
      }),
    );

    const profile = registry.profile(
      'needle-local',
      'extract_requirements',
    );

    expect(profile).toMatchObject({
      nodeId: 'needle-local',
      aspect: 'extract_requirements',
      executions: 3,
      successes: 2,
      successRate: 2 / 3,
    });

    expect(profile.acceptanceRate).toBeCloseTo(2 / 3);
    expect(profile.averageLatencyMs).toBe(500);
    expect(profile.averageQuality).toBeCloseTo(0.6333333333);
  });

  it('returns an empty profile for an unknown node', () => {
    const registry = new PerformanceRegistry();

    const profile = registry.profile(
      'unknown',
      'extract_requirements',
    );

    expect(profile).toEqual({
      nodeId: 'unknown',
      aspect: 'extract_requirements',
      executions: 0,
      successes: 0,
      successRate: 0,
      confidence: 0,
    });
  });

  it('confidence increases with more observations', () => {
    const one = new PerformanceRegistry();

    one.record(
      createObservation({
        timestamp: 1000,
      }),
    );

    const ten = new PerformanceRegistry();

    for (let i = 0; i < 10; i++) {
      ten.record(
        createObservation({
          timestamp: 1000 + i,
        }),
      );
    }

    expect(
      ten.profile('needle-local', 'extract_requirements').confidence,
    ).toBeGreaterThan(
      one.profile('needle-local', 'extract_requirements').confidence,
    );
  });
});
