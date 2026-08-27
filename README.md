# Pi Fabric

Pi Fabric is an experimental orchestration framework for building **model-driven execution fabrics**.

The core idea is to separate:

* **Thinking** — deciding what should happen
* **Planning** — turning intent into executable work
* **Scheduling** — selecting capable nodes
* **Execution** — running tasks
* **Evaluation** — determining whether results are acceptable
* **Replanning** — adapting when execution is not good enough
* **Synthesis** — producing the final result

The long-term goal is a system where a larger reasoning model can act as a **master thinker/orchestrator**, delegating specialized work to smaller local or remote models.

---

## Current Architecture

```text
                         ┌─────────────┐
                         │  Objective  │
                         └──────┬──────┘
                                │
                                ▼
                         ┌─────────────┐
                         │   Thinker   │
                         │  plan()     │
                         └──────┬──────┘
                                │
                              Plan
                                │
                                ▼
                       ┌─────────────────┐
                       │ Plan Validator  │
                       └────────┬────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │   Planner   │
                         └──────┬──────┘
                                │
                         PhysicalPlan
                                │
                                ▼
                       ┌─────────────────┐
                       │  PlanExecutor   │
                       └────────┬────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │   Executor  │
                         └──────┬──────┘
                                │
                         selected Node
                                │
                                ▼
                         ┌─────────────┐
                         │    Node     │
                         └──────┬──────┘
                                │
                              Result
                                │
                                ▼
                         ┌─────────────┐
                         │  Evaluator  │
                         └──────┬──────┘
                                │
                           Evaluation
                                │
                     ┌──────────┴──────────┐
                     │                     │
                 accepted              rejected
                     │                     │
                     ▼                     ▼
                Synthesize             Replan
                                           │
                                           ▼
                                      New Plan
                                           │
                                           └───────► execution
```

The important property is that **Fabric itself does not make domain decisions**. It coordinates the control loop.

---

## Project Structure

```text
src/
├── core/
│   ├── aspect.ts
│   ├── capability.ts
│   ├── context.ts
│   ├── execution-requirements.ts
│   ├── node.ts
│   ├── objective.ts
│   ├── physical-plan.ts
│   ├── physical-task.ts
│   ├── plan.ts
│   └── result.ts
│
├── evaluation/
│   ├── evaluator.ts
│   └── basic.ts
│
├── inference/
│   ├── adapter.ts
│   ├── fake.ts
│   ├── provider.ts
│   ├── request.ts
│   └── response.ts
│
├── nodes/
│   ├── inference-node.ts
│   ├── local.ts
│   └── node.ts
│
├── runtime/
│   ├── aspect-registry.ts
│   ├── executor.ts
│   ├── fabric.ts
│   ├── node-selector.ts
│   ├── plan-executor.ts
│   ├── plan-validator.ts
│   ├── planner.ts
│   ├── registry.ts
│   ├── retry-policy.ts
│   ├── scheduling-policy.ts
│   └── policies/
│       └── quality-first.ts
│
├── thinker/
│   ├── thinker.ts
│   └── fake.ts
│
├── transport/
│   ├── child-process.ts
│   ├── in-process.ts
│   ├── message.ts
│   └── transport.ts
│
├── worker/
│   ├── main.ts
│   └── worker.ts
│
└── create-fabric.ts
```

---

# Core Concepts

## Objective

An objective represents what the user wants accomplished.

```ts
export interface Objective {
  description: string;
}
```

The objective is intentionally high-level.

The Thinker is responsible for turning it into work.

---

## Aspect

An aspect describes a type of work that can be performed.

```ts
export interface Aspect {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
}
```

Example:

```text
extract_requirements
```

Aspects allow the system to reason about **what kind of capability is needed**, independently from the node that performs it.

---

## Capability

Nodes advertise the aspects they can perform along with execution characteristics such as:

* quality
* context window
* latency
* locality

This allows the scheduler to select an appropriate node.

---

## Task

A task is the atomic unit of logical work.

```ts
export interface Task {
  id: string;
  aspect: string;
  input: unknown;

  context: {
    facts: Record<string, unknown>;
    constraints: string[];
    assumptions: string[];
    references: string[];
  };

  outputSchema: unknown;

  dependencies: string[];

  requirements?: ExecutionRequirements;
}
```

Tasks can depend on other tasks.

This enables DAG-style execution.

---

## Plan

A logical plan is simply a collection of tasks:

```ts
export interface Plan {
  tasks: Task[];
}
```

The Thinker produces this.

---

## Physical Plan

The Planner converts logical tasks into executable tasks by selecting a concrete node.

Conceptually:

```text
Logical Task
    +
available capabilities
    +
scheduling policy
    ↓
Physical Task
    +
nodeId
```

This keeps **planning** separate from **execution**.

---

# Thinker

The Thinker is the highest-level orchestration component.

```ts
export interface Thinker {
  plan(
    objective: Objective,
  ): Promise<Plan>;

  evaluate(
    objective: Objective,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<unknown>;

  synthesize(
    objective: Objective,
    results: Result[],
  ): Promise<string>;

  replan(
    objective: Objective,
    previousPlan: Plan,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<Plan>;
}
```

The current implementation is `FakeThinker`.

Eventually this will become the frontier/master model.

Its responsibilities will be:

1. Understand the objective
2. Create a plan
3. Interpret execution results
4. Interpret evaluations
5. Replan when necessary
6. Synthesize the final result

---

# Planner

The Planner resolves each task to a concrete execution node.

```text
Plan
 ↓
find capable nodes
 ↓
NodeSelector
 ↓
PhysicalPlan
```

The current scheduling policy is:

```text
QualityFirstPolicy
```

---

# Node Registry

`NodeRegistry` manages available execution nodes.

Nodes advertise their capabilities.

This allows multiple implementations of the same aspect:

```text
extract_requirements
    │
    ├── local-small-model
    ├── local-large-model
    └── remote-model
```

The selector can then choose between them according to requirements and scheduling policy.

---

# Executor

`Executor` performs work on an individual node.

It currently handles:

* node lookup
* node execution
* failed `Result`s
* thrown execution errors
* retry policies
* fallback to other capable nodes

An important distinction was established:

> A node failure does not necessarily mean `node.execute()` throws.

A node can return:

```ts
{
  success: false,
  ...
}
```

and that is also treated as an execution failure.

---

## Retry

Retries are controlled through:

```ts
export interface RetryPolicy {
  shouldRetry(
    attempt: number,
    error: unknown,
  ): boolean;
}
```

The Executor applies retry policies to both:

* thrown errors
* unsuccessful `Result`s

This keeps retry behavior independent from the Executor itself.

---

## Node Fallback

If a node fails, the Executor can attempt another capable node.

Conceptually:

```text
Node A
  ↓
failure
  ↓
Node B
  ↓
success
```

This is distinct from retrying the same node.

---

# PlanExecutor

`PlanExecutor` handles execution of an entire physical plan.

It currently supports:

### Dependencies

Tasks wait until all dependencies complete.

```text
A ──────► C
          ▲
B ────────┘
```

### Concurrent execution

Independent tasks can execute concurrently.

### Maximum concurrency

A configurable concurrency limit prevents unlimited parallel execution.

```ts
new PlanExecutor(
  executor,
  2,
);
```

### Dependency failure propagation

If a dependency fails, dependent tasks are not executed.

Instead they receive a failed result:

```text
dependency
    ↓
 failure
    ↓
DEPENDENCY_FAILED
    ↓
dependent task skipped
```

This behavior is explicitly tested.

---

# Plan Validation

`PlanValidator` validates a physical plan before execution.

This gives the system a safety boundary between:

```text
Thinker / Planner
       ↓
   PlanValidator
       ↓
   PlanExecutor
```

Invalid plans should not reach execution.

---

# Evaluation

Evaluation is intentionally separate from execution.

```ts
export interface Evaluation {
  taskId: string;
  accepted: boolean;
  issues: string[];
  feedback?: Record<string, unknown>;
}
```

The evaluator answers:

> "Was this result good enough?"

This is different from:

> "Did the node successfully execute?"

A task can execute successfully while producing a result that should be rejected.

Example:

```text
Node execution
    ↓
success = true
    ↓
Evaluator
    ↓
accepted = false
```

This distinction is central to the control loop.

---

## Basic Evaluator

`BasicEvaluator` currently performs simple checks:

* execution failure → rejected
* missing output → rejected
* otherwise → accepted

The evaluator architecture is designed to eventually support model-based evaluation.

---

# Control Loop

Fabric now implements an evaluation-driven execution loop.

Conceptually:

```text
plan
 ↓
validate
 ↓
execute
 ↓
evaluate
 ↓
all accepted?
 ├── yes → synthesize
 │
 └── no
      ↓
    replan
      ↓
    execute again
```

The number of attempts is bounded.

```ts
new Fabric(
  thinker,
  planner,
  planExecutor,
  aspectRegistry,
  planValidator,
  evaluator,
  3,
);
```

If all attempts are exhausted:

```text
Maximum execution attempts exceeded
```

is raised.

This prevents an evaluator/Thinker combination from creating an infinite replanning loop.

---

# Evaluation Feedback

The architecture now allows evaluation feedback to be passed to `Thinker.replan()`.

The intended direction is:

```text
Result
  ↓
Evaluator
  ↓
Evaluation
  ├── accepted
  ├── issues
  └── feedback
       ↓
Thinker
       ↓
revised Plan
```

Structured feedback is intentionally optional at this stage.

A future evaluator could produce information such as:

```ts
{
  taskId: "extract-requirements",
  accepted: false,
  issues: [
    "Missing dimensional constraints",
  ],
  feedback: {
    missing: [
      "bed_width",
      "bed_depth",
    ],
    confidence: 0.42,
  },
}
```

The Thinker can then use that information when creating the next plan.

---

# Transport

Execution is separated from inference transport.

Current transports include:

```text
InProcessTransport
ChildProcessTransport
```

This creates a path toward running workers:

```text
Fabric
  ↓
Node
  ↓
Transport
  ↓
Worker
  ↓
Inference Provider
```

The current default factory uses:

```text
FakeInferenceProvider
        ↓
InProcessTransport
        ↓
InferenceNode
```

This keeps development deterministic while the architecture remains compatible with real workers later.

---

# Current Factory

`createFabric()` provides the default application composition.

It currently wires:

```text
AspectRegistry
NodeRegistry
FakeInferenceProvider
InProcessTransport
InferenceNode
QualityFirstPolicy
NodeSelector
Executor
PlanExecutor
Planner
PlanValidator
BasicEvaluator
FakeThinker
Fabric
```

This acts as the composition root for the system.

---

# Current Example

The basic integration test currently looks conceptually like:

```ts
const fabric = createFabric();

const result = await fabric.run({
  description:
    "Analyze a mechanical design and identify its requirements.",
});
```

The current FakeThinker creates an `extract_requirements` task.

The task is planned, validated, executed, evaluated, and synthesized.

---

# Testing

The project currently has a substantial test suite covering the runtime architecture.

The suite covers:

* node selection
* capability matching
* execution
* execution failures
* retries
* node fallback
* plan execution
* dependency ordering
* concurrent execution
* concurrency limits
* dependency failures
* transport behavior
* inference adapters
* plan validation
* aspect registration
* Fabric orchestration
* evaluation
* replanning
* evaluation-driven control flow
* feedback propagation

Current state:

```text
39 tests passing
```

The test suite is an important part of the architecture because many of the runtime guarantees are behavioral contracts.

Run:

```bash
npm test
```

---

# Formatting

The project uses Prettier for formatting.

Format the entire project:

```bash
npm run format
```

Recommended scripts:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

A `.prettierignore` should exclude:

```text
node_modules
dist
coverage
```

The intended development toolchain is:

```text
Prettier     → formatting
ESLint       → code quality
TypeScript   → type correctness
Vitest       → behavior
```

---

# Design Principles

## 1. Thinker does not execute

The Thinker decides **what should happen**.

It does not directly execute nodes.

---

## 2. Planner does not execute

The Planner determines **where/how tasks should execute**.

It produces a physical plan.

---

## 3. Executor does not plan

The Executor executes a task on a selected node.

It handles execution concerns such as retries and failures.

---

## 4. Evaluator does not replan

The Evaluator judges results.

It should not decide what the next plan should be.

---

## 5. Fabric coordinates

Fabric is the control-plane component.

Its job is to coordinate:

```text
Think
 → Plan
 → Validate
 → Schedule
 → Execute
 → Evaluate
 → Replan
 → Synthesize
```

without embedding domain-specific reasoning.

---

# Roadmap

## Near Term

* [x] Core task/plan/result model
* [x] Aspect registry
* [x] Capability model
* [x] Node registry
* [x] Node selection
* [x] Quality-first scheduling policy
* [x] Executor
* [x] Retry policy
* [x] Node fallback
* [x] Plan executor
* [x] Dependency handling
* [x] Concurrent execution
* [x] Concurrency limits
* [x] Plan validation
* [x] Transport abstraction
* [x] In-process transport
* [x] Child-process transport
* [x] Thinker abstraction
* [x] Evaluator abstraction
* [x] Evaluation-driven replanning
* [x] Attempt limits
* [x] Fabric composition root
* [x] Test factory
* [x] Structured evaluation feedback field

## Next

* [ ] Define a stronger feedback/context contract
* [ ] Improve evaluation semantics
* [ ] Separate execution failure from quality failure more explicitly
* [ ] Add richer evaluator implementations
* [ ] Improve plan validation errors
* [ ] Add observability/tracing
* [ ] Add execution metadata aggregation
* [ ] Introduce real inference providers
* [ ] Introduce real model-backed Thinker
* [ ] Improve worker lifecycle management
* [ ] Add remote transport
* [ ] Add persistence for plans/results
* [ ] Add CLI/API entry points

## Longer Term

The eventual architecture should support:

```text
                    Master Thinker
                          │
                    ┌─────┴─────┐
                    │   Planner │
                    └─────┬─────┘
                          │
                  ┌───────┼───────┐
                  ▼       ▼       ▼
                Worker  Worker  Worker
                  │       │       │
                model   model   model
                  │       │       │
                  └───────┼───────┘
                          ▼
                       Results
                          │
                       Evaluate
                          │
                    ┌─────┴─────┐
                    │           │
                 accept       reject
                    │           │
                    ▼           ▼
                Synthesize    Replan
```

The long-term goal is a **model orchestration fabric**, not simply a task runner.

---

# Status

Pi Fabric is currently in the **core runtime/control-loop phase**.

The foundational execution architecture is working:

```text
Objective
   ↓
Thinker
   ↓
Plan
   ↓
Validation
   ↓
Physical Plan
   ↓
Concurrent Execution
   ↓
Results
   ↓
Evaluation
   ↓
Replanning
   ↓
Synthesis
```

The next major milestone is moving from a mechanically correct control loop toward a **meaningful model-driven control loop**, where evaluation feedback materially improves subsequent plans.
