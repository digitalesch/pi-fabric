import type { PerformanceObservation } from '../core/performance-observation.js';
import type { PerformanceProfile } from '../core/performance-profile.js';

export class PerformanceRegistry {
  private readonly observations: PerformanceObservation[] = [];

  record(observation: PerformanceObservation): void {
    this.observations.push({ ...observation });
  }

  all(): PerformanceObservation[] {
    return this.observations.map((observation) => ({
      ...observation,
    }));
  }

  forProvider(
    provider: string,
    aspect: string,
  ): PerformanceObservation[] {
    return this.observations
      .filter(
        (observation) =>
          observation.provider === provider &&
          observation.aspect === aspect,
      )
      .map((observation) => ({
        ...observation,
      }));
  }

  profile(
    provider: string,
    aspect: string,
  ): PerformanceProfile {
    const observations = this.forProvider(provider, aspect);

    if (observations.length === 0) {
      return {
        provider,
        aspect,
        executions: 0,
        successes: 0,
        successRate: 0,
        confidence: 0,
      };
    }

    const successes = observations.filter(
      (observation) => observation.success,
    ).length;

    const latencies = observations
      .map((observation) => observation.latencyMs)
      .filter(
        (latency): latency is number =>
          latency !== undefined,
      );

    const qualities = observations
      .map((observation) => observation.evaluation?.score)
      .filter(
        (score): score is number =>
          score !== undefined,
      );

    const averageLatencyMs =
      latencies.length > 0
        ? latencies.reduce(
            (sum, latency) => sum + latency,
            0,
          ) / latencies.length
        : undefined;

    const averageQuality =
      qualities.length > 0
        ? qualities.reduce(
            (sum, quality) => sum + quality,
            0,
          ) / qualities.length
        : undefined;

    const confidence =
      observations.length /
      (observations.length + 10);

    return {
      provider,
      aspect,
      executions: observations.length,
      successes,
      successRate: successes / observations.length,
      averageLatencyMs,
      averageQuality,
      confidence,
    };
  }
}