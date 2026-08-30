# Model Fleet Architecture

## Purpose

Pi-Fabric treats inference models as a **heterogeneous fleet of workers**, rather than as interchangeable API endpoints.

The architecture separates four responsibilities:

```text
Provider
   ↓
Node
   ↓
Scheduling
   ↓
Execution
```

with evaluation and memory forming the feedback loop:

```text
Execution
   ↓
Evaluation
   ↓
Fleet Memory
   ↓
Future Scheduling
```

## Provider

A provider is the backend that performs inference.

Examples include:

- Needle
- HTTP inference services
- local models
- future model providers

A provider should primarily answer:

> How do I execute an inference request?

It should not decide whether it is the best worker for a particular task.

---

## Node

A node exposes a provider to Fabric's execution system.

The node associates the provider with capabilities such as:

```text
aspect
quality
context window
latency
locality
```

This allows the runtime to reason about heterogeneous workers without coupling itself to provider implementations.

---

## Node Selection

`NodeSelector` and scheduling policies decide which eligible node should execute a task.

For example:

```text
Task
  ↓
Eligible nodes
  ↓
QualityFirstPolicy
  ↓
Best node
```

Other policies can optimize different objectives:

- latency
- quality
- availability
- load
- cost
- reliability

The provider itself does not make this decision.

---

## Evaluation

Execution results are evaluated after completion.

Evaluation answers:

> Was the result actually good?

This is deliberately separate from the provider's declared capability.

A provider may advertise high quality while empirical evaluation reveals that it performs poorly for a particular aspect.

---

## Fleet Memory

Evaluation results can eventually be persisted as execution observations.

These observations form an empirical profile of the fleet.

```text
Declared capability
        +
Observed performance
        +
Historical evaluations
        ↓
   Fleet Memory
```

This allows scheduling decisions to become increasingly evidence-based.

---

## Design Principle

The system should improve through **better orchestration**, not necessarily through model retraining.

This means Pi-Fabric can evolve its behavior while keeping the underlying models unchanged.

The models are workers.

Fabric is the system that learns how to use those workers.
