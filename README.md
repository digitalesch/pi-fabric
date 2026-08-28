# Pi Fabric

Pi Fabric is an execution fabric for orchestrating heterogeneous model nodes.

The core idea is to separate **planning**, **scheduling**, **execution**, and **evaluation** so that different models can collaborate on complex objectives without every model having to perform the entire reasoning process.

Pi Fabric is intentionally **model-agnostic**. The runtime provides the machinery for planning and executing work; model nodes are replaceable execution resources.

---

## Architecture

Pi Fabric follows this execution flow:

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
   ├── ExecutionState
   └── ExecutionHistory
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

For a deeper explanation of the execution lifecycle, see [`docs/execution-model.md`](docs/execution-model.md).

For execution introspection and observability, see [`docs/observability.md`](docs/observability.md).

---

## Core Concepts

### Thinker

The `Thinker` is responsible for high-level reasoning around an objective.

It can:

- create an initial plan
- evaluate execution results
- replan after failed evaluation
- synthesize the final result

The `Thinker` intentionally operates above the execution layer.

It decides:

> **What should happen?**

The runtime determines:

> **How and where should it happen?**

---

### Task

A task represents a logical unit of work.

Tasks describe:

- the aspect they address
- input
- contextual information
- expected output
- dependencies
- execution requirements

A task does **not** specify which model should execute it.

```text
Task
 │
 └── describes WHAT needs to happen

ModelNode
 │
 └── describes WHERE / WITH WHAT resource it happens
```

This separation allows the same logical task to be executed by different nodes.

---

### TaskGraph

`TaskGraph` provides the dependency graph abstraction used by the execution layer.

It is responsible for:

- validating task IDs
- validating dependencies
- detecting duplicate dependencies
- detecting missing dependencies
- detecting dependency cycles
- identifying root tasks
- finding ready tasks
- finding direct dependents
- producing topological ordering

DAG semantics are therefore kept separate from execution mechanics.

For example:

```text
      A
     / \
    B   C
     \ /
      D
```

The graph can answer questions such as:

```ts
graph.dependencies('D');
// ['B', 'C']

graph.dependents('A');
// ['B', 'C']

graph.ready(completed);
// tasks whose dependencies are satisfied
```

---

### ModelNode

A `ModelNode` represents an execution resource.

A node may represent:

- a local language model
- a remote model API
- a specialized model
- a deterministic tool
- another computational worker

Nodes advertise capabilities so the fabric can select an appropriate execution resource for each task.

A capability can describe properties such as:

```text
aspect
quality
context window
latency
locality
```

---

### Node Selection

`NodeSelector` delegates node selection to a scheduling policy.

The current policy is:

```text
QualityFirstPolicy
```

The policy considers execution requirements such as:

- minimum quality
- minimum context window
- local-only execution
- maximum latency

It then selects the highest-quality capable node.

The separation allows additional scheduling strategies to be introduced without changing the planner or executor.

Possible future policies include:

```text
QualityFirst
LatencyFirst
LocalFirst
CostFirst
LoadAware
```

---

### Planner

The `Planner` converts a logical `Plan` into a `PhysicalPlan`.

For each task it:

1. finds nodes capable of handling the task's aspect
2. applies the configured scheduling policy
3. assigns an execution node
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

The planner answers:

> **Where should this task run?**

---

### PlanExecutor

`PlanExecutor` executes a physical plan while respecting task dependencies.

It uses `TaskGraph` to determine which tasks are ready.

Independent tasks can execute concurrently, subject to `maxConcurrency`.

For:

```text
      A
     / \
    B   C
     \ /
      D
```

once `A` completes, `B` and `C` may execute concurrently.

Dependency failures are propagated through the graph:

```text
A ── failed
│
▼
B ── blocked
```

A blocked task is never sent to its model node.

`PlanExecutor` also coordinates:

- execution lifecycle state
- execution event recording
- concurrency
- dependency failure propagation
- execution completion

---

### ExecutionState

`ExecutionState` represents the **current lifecycle state** of tasks.

A task can move through:

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

`ExecutionState` tracks:

- current status
- start time
- completion time
- execution duration
- task result

It also exposes an `ExecutionSnapshot`, which provides an aggregate view of the current run:

```text
total
pending
running
completed
failed
blocked
finished
executions
durationMs
```

The distinction between a result and execution state is intentional:

```text
Result
 │
 └── What did execution produce?

ExecutionState
 │
 └── What is the task's lifecycle state?
```

---

### ExecutionHistory

`ExecutionHistory` records what happened during execution.

Events include:

```text
task_started
task_completed
task_failed
task_blocked
task_retrying
```

Each event can contain information such as:

```text
taskId
nodeId
attempt
result
timestamp
```

History answers:

> **What happened during this execution?**

For example:

```text
task_started
task_retrying
task_started
task_completed
```

This is deliberately different from current execution state.

A task may currently be:

```text
completed
```

while its history contains several events documenting retries.

---

### Execution Metrics

Execution metrics are derived from the execution snapshot and history.

The runtime currently exposes metrics including:

```text
totalTasks
completedTasks
failedTasks
blockedTasks
successRate
totalDurationMs
averageDurationMs
retryCount
```

This provides a lightweight quantitative view of an execution without coupling metrics to the executor itself.

---

### Critical Path

The runtime can calculate the critical path through a completed execution graph.

The critical path represents the dependency chain with the greatest cumulative execution duration.

For example:

```text
A ── 10ms ──► B ── 30ms ──► D
 \
  └─ 5ms ──► C ── 5ms ─────► D
```

The runtime identifies:

```text
A → B → D
```

as the critical path.

Zero-duration tasks remain part of the path when they connect otherwise critical tasks.

When paths have equal duration, the runtime prefers the path containing more tasks. This preserves the complete dependency chain rather than arbitrarily dropping zero-duration nodes.

Critical-path analysis provides a foundation for:

- performance analysis
- bottleneck identification
- scheduling improvements
- execution visualization

---

### Executor

`Executor` handles execution against a specific node.

It is responsible for:

- looking up nodes
- executing tasks
- retrying failed execution when configured
- converting thrown node errors into `Result`s
- failing over between candidate nodes

Node selection is intentionally outside this class.

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

Retries are controlled by a `RetryPolicy`.

A node can therefore fail temporarily without immediately causing the entire execution to fail.

If a node exhausts its retry attempts, the executor can move to another candidate node when one is available.

---

### Evaluator

The evaluator assesses individual execution results.

Its output is represented by an `Evaluation` containing:

- task ID
- acceptance status
- issues

Execution success and evaluation acceptance are deliberately separate.

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

---

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
 ├──► ExecutionState
 │
 └──► ExecutionHistory
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

The fabric limits execution/replanning attempts to prevent unbounded loops.

---

## Design Principles

### Separation of Concerns

Planning, scheduling, execution, evaluation, and orchestration remain independently replaceable.

### Capability-Driven Execution

Tasks describe what they need rather than which model should execute them.

### Policy-Driven Scheduling

Node selection is configurable through scheduling policies.

### DAG-Native Execution

Dependencies are first-class objects rather than incidental executor logic.

### Model Heterogeneity

Different tasks can be assigned to different models based on their capabilities and requirements.

### Explicit Execution Lifecycle

Current task state and historical execution events are represented separately.

### Observable Runtime

Execution state, history, metrics, and critical-path analysis provide introspection without coupling observability concerns into core execution mechanics.

### Test-Driven Architecture

New abstractions are introduced through explicit behavioral contracts and tested before being integrated into the execution path.

---

## Testing

The test suite is the behavioral safety net for the architecture.

Coverage currently includes:

- task and plan modeling
- node selection
- scheduling policies
- planning
- execution
- retries
- node failover
- dependency handling
- DAG validation
- cycle detection
- concurrent execution
- execution state
- execution snapshots
- execution history
- retry history
- execution metrics
- critical-path analysis
- evaluation
- replanning
- execution runs
- fabric orchestration

Run the full suite with:

```bash
npm test
```

The current test suite contains **216 passing tests**.

The number is intentionally tracked as an indicator of the growing behavioral contract rather than as a measure of implementation quality by itself.

---

## Current Status

The major runtime pieces currently in place are:

- [x] Task model
- [x] Plan model
- [x] Physical plan
- [x] Model nodes
- [x] Node registry
- [x] Capability model
- [x] Execution requirements
- [x] Node selection
- [x] Quality-first scheduling policy
- [x] Planner
- [x] Executor
- [x] Retry policy
- [x] Node failover
- [x] Plan executor
- [x] DAG dependency handling
- [x] Task graph validation
- [x] Cycle detection
- [x] Concurrent execution
- [x] Plan validation
- [x] Execution state
- [x] Execution snapshot
- [x] Execution history
- [x] Execution event recording
- [x] Retry event recording
- [x] Execution metrics
- [x] Critical-path analysis
- [x] Evaluator
- [x] Thinker interface
- [x] Evaluation/replanning loop
- [x] Fabric orchestration
- [x] Runtime test coverage

---

## Next

The next architectural focus is **observability and execution introspection**.

The runtime now has the foundations for:

- execution timelines
- progress reporting
- task duration metrics
- critical-path analysis
- execution tracing
- debugging tools
- DAG visualization
- retry analysis
- richer scheduling decisions

The goal is to make the fabric not only capable of executing a plan, but capable of explaining:

> **What is it doing? Why is it doing it? What happened at each stage?**

Pi Fabric should evolve toward an execution system where planning, execution, evaluation, and observation remain distinct but work together as a coherent runtime.

```

```
