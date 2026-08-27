# Pi Fabric

Pi Fabric is an execution fabric for orchestrating heterogeneous model nodes.

The core idea is to separate **planning**, **scheduling**, **execution**, and **evaluation** so that different models can collaborate on complex objectives without every model having to perform the entire reasoning process.

## Architecture

Pi Fabric currently follows this execution flow:

```text
Objective
   │
   ▼
Thinker
   │
   │ creates Plan
   ▼
Planner
   │
   ├── AspectRegistry
   ├── NodeRegistry
   └── NodeSelector
          │
          └── SchedulingPolicy
   │
   ▼
PhysicalPlan
   │
   ▼
PlanExecutor
   │
   ├── TaskGraph
   └── ExecutionState
   │
   ▼
Executor
   │
   ▼
ModelNode
   │
   ▼
Result
   │
   ▼
Evaluator
   │
   ▼
Thinker
   │
   ├── accepted ──► Synthesize
   │
   └── rejected ──► Replan
                         │
                         └──► execute again
```

For a deeper explanation of the execution model, see [`docs/execution-model.md`](docs/execution-model.md).

## Core Concepts

### Thinker

The `Thinker` is responsible for high-level reasoning around an objective.

It can:

* create an initial plan
* evaluate execution results
* replan after failed evaluation
* synthesize the final result

The `Thinker` intentionally operates above the execution layer. It decides **what should happen**, while the runtime determines **how and where it happens**.

### Task

A task represents a logical unit of work.

Tasks describe:

* what aspect they address
* their input
* contextual information
* expected output
* dependencies
* execution requirements

A task does **not** specify which model should execute it.

This distinction is fundamental:

```text
Task
  │
  └── describes WHAT needs to happen

ModelNode
  │
  └── describes WHERE / WITH WHAT resource it happens
```

### TaskGraph

`TaskGraph` provides the dependency graph abstraction used by the execution layer.

It is responsible for:

* validating task IDs
* validating dependencies
* detecting duplicate dependencies
* detecting missing dependencies
* detecting dependency cycles
* identifying root tasks
* finding ready tasks
* finding direct dependents
* producing topological ordering

This keeps DAG semantics separate from the execution mechanics.

For example:

```text
       A
      / \
     B   C
      \ /
       D
```

For this graph:

```ts
graph.dependencies('D');
// ['B', 'C']

graph.dependents('A');
// ['B', 'C']

graph.ready(completed);
// tasks whose dependencies are satisfied
```

### ModelNode

A `ModelNode` represents an execution resource.

A node may represent:

* a local language model
* a remote model API
* a specialized model
* a deterministic tool
* another computational worker

Nodes advertise their capabilities so the fabric can select an appropriate execution resource for each task.

A capability describes properties such as:

```text
aspect
quality
context window
latency
locality
```

This allows the same logical task to potentially be executed by different models.

### Node Selection

`NodeSelector` delegates node selection to a scheduling policy.

The current policy is:

```text
QualityFirstPolicy
```

It filters candidates according to execution requirements such as:

* minimum quality
* minimum context window
* local-only execution
* maximum latency

It then selects the highest-quality capable node.

This separation allows additional scheduling policies to be introduced without changing the planner or executor.

Future policies could include:

```text
QualityFirst
LatencyFirst
LocalFirst
CostFirst
LoadAware
```

### Planner

The `Planner` converts a logical `Plan` into a `PhysicalPlan`.

For every task it:

1. finds nodes capable of handling the task's aspect
2. applies the configured scheduling policy
3. assigns the selected node
4. produces a physical task

```text
Logical Task
     │
     ▼
NodeRegistry
     │
     ▼
NodeSelector
     │
     ▼
Physical Task
```

The planner therefore answers:

> **Where should this task run?**

### PlanExecutor

`PlanExecutor` executes a physical plan while respecting task dependencies.

It uses the task graph to determine which tasks are ready to execute.

Independent tasks can execute concurrently, subject to `maxConcurrency`.

For example:

```text
       A
      / \
     B   C
      \ /
       D
```

Once `A` completes, `B` and `C` can execute concurrently.

The executor also propagates dependency failures:

```text
A ── failed
│
▼
B ── blocked
```

A blocked task is not sent to its model node.

### ExecutionState

`ExecutionState` represents the lifecycle of tasks during execution.

A task can move through states such as:

```text
pending
   │
   ▼
running
   │
   ├──► completed
   │
   └──► failed

pending
   │
   ▼
blocked
```

This separates execution lifecycle from execution results.

A `Result` answers:

> What did execution produce?

`ExecutionState` answers:

> What happened to this task?

This provides the foundation for observability, debugging, execution history, and future scheduling decisions.

### Executor

`Executor` handles execution against a specific node.

It is responsible for:

* looking up nodes
* executing tasks
* retrying failed execution when configured
* converting thrown node errors into `Result`s

Node selection is intentionally outside this class.

The separation is:

```text
NodeSelector
    │
    │ chooses WHERE
    ▼
Executor
    │
    │ executes
    ▼
ModelNode
```

### Evaluator

The evaluator assesses individual execution results.

Its output is represented by an `Evaluation` containing:

* task ID
* acceptance status
* issues

Execution success and evaluation acceptance are deliberately separate concepts.

A task can execute successfully while still producing a result that the evaluator rejects:

```text
ModelNode
   │
   ▼
Result
success = true
   │
   ▼
Evaluator
   │
   ▼
Evaluation
accepted = false
```

### Fabric

`Fabric` is the high-level orchestration boundary.

A run follows this general loop:

```text
Think
  │
  ▼
Plan
  │
  ▼
Validate
  │
  ▼
Schedule
  │
  ▼
Execute
  │
  ▼
Evaluate
  │
  ├── accepted ──► Synthesize
  │
  └── rejected ──► Replan
                       │
                       └──► Execute again
```

The fabric limits the number of execution/replanning attempts to prevent unbounded loops.

## Design Principles

Pi Fabric is being built around a few core principles.

### Separation of Concerns

Planning, scheduling, execution, evaluation, and orchestration should remain independently replaceable.

### Capability-Driven Execution

Tasks should describe what they need rather than which model should execute them.

### Policy-Driven Scheduling

Node selection should be configurable through scheduling policies.

### DAG-Native Execution

Dependencies are first-class objects rather than incidental executor logic.

### Model Heterogeneity

Different tasks can be assigned to different models based on their capabilities and requirements.

### Test-Driven Architecture

New abstractions are introduced through explicit behavioral contracts and tested before being integrated into the execution path.

## Testing

The test suite provides the behavioral safety net for the architecture.

Coverage currently includes:

* node selection
* scheduling policies
* planning
* execution
* retries
* dependency handling
* DAG validation
* cycle detection
* concurrency
* execution state
* evaluation and replanning
* fabric orchestration

Run the suite with:

```bash
npm test
```

The project currently has **122+ passing tests**.

## Current Status

The major runtime pieces currently in place are:

* [x] Task model
* [x] Plan model
* [x] Physical plan
* [x] Model nodes
* [x] Node registry
* [x] Capability model
* [x] Execution requirements
* [x] Node selection
* [x] Quality-first scheduling policy
* [x] Planner
* [x] Executor
* [x] Retry policy
* [x] Plan executor
* [x] DAG dependency handling
* [x] Task graph validation
* [x] Cycle detection
* [x] Concurrent execution
* [x] Plan validation
* [x] Execution state
* [x] Evaluator
* [x] Thinker interface
* [x] Evaluation/replanning loop
* [x] Fabric orchestration
* [x] Runtime test coverage

## Next

The next architectural focus is **observability and execution introspection**.

With explicit execution state and a first-class task graph, Pi Fabric now has the foundation for:

* execution events
* progress reporting
* execution history
* metrics
* tracing
* debugging
* DAG visualization
* retry history
* richer scheduling decisions

The goal is to make the fabric not only capable of executing a plan, but also capable of explaining **what it is doing, why it is doing it, and what happened at each stage**.
