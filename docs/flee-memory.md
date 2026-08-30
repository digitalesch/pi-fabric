# Fleet Memory

## Overview

Pi-Fabric is designed to become smarter without retraining the models it orchestrates.

The models in the fleet remain independent workers. Fabric does not modify their weights or attempt to retrain them after every execution. Instead, Fabric builds an **empirical model of the fleet** by observing how providers and nodes perform over time.

This creates a separation between:

- **Model intelligence** — what the underlying model knows.
- **Worker intelligence** — how a model is configured and exposed as a node.
- **Fabric intelligence** — what the orchestration system has learned from previous executions.

The goal is to make future execution decisions increasingly informed by experience.

---

## The Model Fleet

A Fabric deployment may contain many different inference providers:

```text
                Pi-Fabric
                    │
             ┌──────┴──────┐
             │  Model Fleet │
             └──────┬──────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
     Needle        HTTP       Local LLM
       │            │            │
       ▼            ▼            ▼
     Node         Node         Node
```

Each worker may have different characteristics:

- supported aspects
- quality
- context window
- latency
- locality
- availability
- cost
- reliability

These characteristics form the worker's **declared capability**.

For example:

```ts
{
  aspect: 'extract_requirements',
  quality: 0.95,
  contextWindow: 4096,
  local: true,
  latencyMs: 400
}
```

These values describe what Fabric currently believes the worker is capable of.

They are not necessarily the final truth.

---

## Declared Capability vs Observed Performance

A central design principle is that **capability and performance are different things**.

A provider may declare:

```text
quality = 0.95
```

but Fabric may eventually observe:

```text
observed quality = 0.82
```

after hundreds of executions.

Therefore, Fabric should preserve both.

### Capability

Describes the worker's declared or configured properties.

```text
Capability
├── aspect
├── quality
├── contextWindow
├── local
└── latency
```

### Performance

Describes what Fabric has actually observed.

```text
Performance
├── executions
├── successes
├── failures
├── observed quality
├── observed latency
└── confidence
```

This allows Fabric to distinguish:

> "The provider says it is good at this."

from:

> "We have evidence that it is good at this."

That distinction becomes increasingly important as the fleet grows.

---

# Execution Memory

Every completed task can produce an observation.

Conceptually:

```ts
{
  provider: 'needle',
  aspect: 'extract_requirements',
  success: true,
  evaluation: 0.94,
  latencyMs: 382,
  timestamp: '...'
}
```

These observations should accumulate over time.

Fabric can then derive a current performance profile:

```ts
{
  provider: 'needle',
  aspect: 'extract_requirements',

  executions: 183,

  successRate: 0.97,

  observedQuality: 0.93,

  observedLatencyMs: 410,

  confidence: 0.91
}
```

The profile is therefore not manually programmed.

It is **learned from execution history**.

---

# Fabric Intelligence

The larger thinker can use this information when planning.

Instead of reasoning only from static capabilities:

```text
Task
  ↓
Available capabilities
  ↓
Thinker
  ↓
Plan
```

the system can eventually reason from both capabilities and experience:

```text
Task
  ↓
Capabilities
  ↓
Fleet Memory
  ↓
Thinker
  ↓
Plan
```

For example:

```text
Task:
Extract requirements from a technical document.

Needle:
  declared quality: 0.95
  observed quality: 0.93
  success rate: 97%
  average latency: 410ms
  observations: 183

Local model:
  declared quality: 0.80
  observed quality: 0.81
  success rate: 99%
  average latency: 32ms
  observations: 891
```

The thinker can make a context-dependent decision.

For a high-quality extraction:

```text
Use Needle.
```

For a latency-sensitive operation:

```text
Use the local model.
```

The important point is that the decision is based on **experience**, not only metadata.

---

# Learning Without Retraining

Pi-Fabric does not need to retrain the underlying models to improve.

The model weights remain unchanged.

Instead:

```text
Model
  │
  │ executes
  ▼
Fabric
  │
  ├── observes result
  ├── evaluates result
  ├── records latency
  ├── records success/failure
  └── updates fleet memory
             │
             ▼
       better future decisions
```

This means improvement happens at the orchestration layer.

A model does not need to become smarter internally for the system to become better at using it.

---

# Historical Evidence

Fleet Memory should preserve observations rather than only storing a final score.

Avoid storing only:

```ts
quality = 0.91;
```

Prefer storing evidence such as:

```ts
{
  provider: 'needle',
  aspect: 'extract_requirements',
  success: true,
  evaluation: 0.94,
  latencyMs: 382,
  timestamp: '...'
}
```

The current performance profile can then be derived from this history.

This provides several advantages.

### Explainability

Fabric can answer:

> Why does it believe this provider is good at this task?

For example:

> Needle has completed 1,284 executions of `extract_requirements` with a median evaluation of 0.93.

### Adaptability

Performance can change over time.

A provider may become slower, less reliable, or better suited to a particular class of tasks.

### Debugging

Historical observations make it possible to understand why routing decisions changed.

### Experimentation

New providers can enter the fleet with little historical knowledge and gradually establish a performance profile.

---

# Cold Start

A new worker has no historical evidence.

For example:

```text
New Provider

observations: 0
observedQuality: unknown
confidence: unknown
```

Fabric should therefore distinguish between:

```text
declared capability
```

and:

```text
empirical confidence
```

A new provider may claim excellent quality but have no execution history.

The thinker or scheduler can account for this uncertainty.

Over time:

```text
0 observations
      ↓
10 observations
      ↓
100 observations
      ↓
1,000 observations
      ↓
high-confidence performance profile
```

This creates a natural exploration/exploitation problem for the scheduler.

---

# The Feedback Loop

The long-term architecture forms a feedback loop:

```text
                 ┌───────────────┐
                 │    Thinker    │
                 └───────┬───────┘
                         │
                       Plan
                         │
                         ▼
                 ┌───────────────┐
                 │    Planner    │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Node Selector │
                 └───────┬───────┘
                         │
                         ▼
                    Model Fleet
                         │
                         ▼
                     Execution
                         │
                         ▼
                    Evaluation
                         │
                         ▼
                  Fleet Memory
                         │
                         └──────────────┐
                                        │
                                        ▼
                                   Next Plan
```

Every execution becomes another piece of evidence.

This is the mechanism through which the system improves.

---

# A Fleet, Not a Collection of Models

The ultimate abstraction is therefore not:

> "Pi-Fabric is a wrapper around several models."

It is:

> **"Pi-Fabric manages a fleet of heterogeneous workers and learns how to use that fleet effectively."**

The underlying models are replaceable.

A provider can disappear.

A new model can be added.

A local model can improve.

An external API can become slower.

The Fabric can adapt because its knowledge is stored at the orchestration layer.

---

# Future Direction

Fleet Memory is intentionally separate from model training.

Future implementations may track:

- quality by aspect
- quality by task type
- latency distributions
- success/failure rates
- cost
- context-window effectiveness
- provider availability
- evaluator feedback
- historical routing decisions
- confidence in performance estimates
- temporal performance changes

Eventually, this information can become part of the thinker's planning context.

The result is a system where:

```text
Models provide intelligence.
Workers provide capabilities.
Execution provides evidence.
Memory provides experience.
The thinker uses that experience to plan.
```

The models do not need to be retrained for Pi-Fabric to become better at using them.
