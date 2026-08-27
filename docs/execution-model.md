# Pi Fabric Execution Model

Pi Fabric is an execution fabric for coordinating heterogeneous model nodes.

The system separates **reasoning**, **planning**, **scheduling**, **execution**, and **evaluation** so that each responsibility can evolve independently.

The easiest way to understand Pi Fabric is to follow one objective from beginning to end.

---

## 1. The Big Picture

A complete execution follows this flow:

```text
Objective
   │
   ▼
Thinker
   │
   │ creates logical Plan
   ▼
Plan
   │
   ▼
Planner
   │
   ├── NodeRegistry
   ├── NodeSelector
   │      └── SchedulingPolicy
   │
   ▼
PhysicalPlan
   │
   ▼
PlanExecutor
   │
   ├── TaskGraph
   ├── ExecutionState
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

The `Fabric` is the high-level orchestrator connecting these pieces.

---

# 2. Objective

An `Objective` represents what the user wants the system to accomplish.

The objective is intentionally high-level.

It does not specify:

- which model should execute the work
- which machine should perform it
- how tasks should be ordered
- how many workers are required

Those decisions belong to later stages.

```text
Objective
   │
   │ "What do we want?"
   ▼
Thinker
```

---

# 3. Thinker

The `Thinker` is responsible for high-level reasoning.

It has four responsibilities:

```text
plan()
evaluate()
replan()
synthesize()
```

### `plan()`

Creates the initial logical plan.

```text
Objective
    │
    ▼
 Thinker
    │
    ▼
  Plan
```

### `evaluate()`

Receives the results and evaluations from execution and decides what should happen next.

### `replan()`

Creates a new plan when execution does not satisfy the objective.

This is important because the system does not assume that the first plan will always be correct.

### `synthesize()`

Combines successful execution results into the final answer.

---

# 4. Plan

A `Plan` is a collection of logical `Task`s.

A logical task describes **what needs to be done**, not where it should run.

```ts
interface Task {
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

The important distinction is:

```text
Task
=
WHAT needs to happen
```

rather than:

```text
Task
=
WHAT needs to happen + WHICH MODEL executes it
```

That separation allows the same logical plan to run against different infrastructure.

---

# 5. Planner

The `Planner` converts the logical plan into a physical plan.

For every task it:

1. finds nodes capable of handling the task's aspect
2. applies the node-selection policy
3. selects a node
4. creates a physical task

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
SchedulingPolicy
     │
     ▼
Physical Task
```

The planner therefore answers:

> **Where should this task run?**

---

# 6. Capabilities

Nodes advertise capabilities.

A capability describes what a node can do and how well it can do it.

Conceptually:

```text
Node
 │
 ├── aspect
 ├── quality
 ├── context window
 ├── latency
 └── locality
```

For example:

```text
Node A
  extract_requirements
  quality: 0.8
  context: 8192
  local: true

Node B
  extract_requirements
  quality: 0.95
  context: 32768
  local: false
```

A task can then express requirements such as:

```text
minimum quality: 0.9
minimum context: 16000
local only: false
```

The planner does not need to know the implementation details of either node.

---

# 7. Scheduling Policies

`NodeSelector` delegates the actual selection strategy to a `SchedulingPolicy`.

The current implementation uses:

```text
QualityFirstPolicy
```

The policy first filters nodes that do not satisfy the task requirements.

It then selects the highest-quality remaining candidate.

This separation is intentional.

The system can eventually support policies such as:

```text
QualityFirst
LatencyFirst
LocalFirst
CostFirst
RoundRobin
LoadAware
```

without changing the planner.

---

# 8. PhysicalPlan

A `PhysicalPlan` contains `PhysicalTask`s.

A physical task adds the execution location to the logical task.

Conceptually:

```text
Task
 │
 └── nodeId
       │
       ▼
PhysicalTask
```

The logical plan answers:

> What should happen?

The physical plan answers:

> What should happen, and where?

---

# 9. TaskGraph

Once a physical plan exists, execution needs to understand dependencies.

This is the responsibility of `TaskGraph`.

Consider:

```text
       A
      / \
     B   C
      \ /
       D
```

The graph represents:

```text
A
├── B
│   └── D
└── C
    └── D
```

`TaskGraph` provides operations for understanding this structure.

### Dependencies

```text
dependencies(D)
→ [B, C]
```

### Dependents

```text
dependents(A)
→ [B, C]
```

### Roots

```text
roots()
→ [A]
```

### Ready tasks

Given completed tasks:

```text
completed = [A]
```

the graph can determine:

```text
ready()
→ [B, C]
```

### Topological ordering

The graph can also produce an order that respects dependencies:

```text
A → B → C → D
```

The exact ordering of independent tasks is not semantically important.

What matters is:

```text
dependency always comes before dependent
```

---

# 10. DAG Validation

`TaskGraph` validates the dependency structure.

It rejects:

### Duplicate task IDs

```text
A
A
```

### Missing dependencies

```text
A → X

X does not exist
```

### Duplicate dependencies

```text
A → B
A → B
```

### Cycles

```text
A → B
↑   │
└───┘
```

A task graph must be a DAG:

**Directed Acyclic Graph.**

This validation happens before execution can proceed.

---

# 11. PlanExecutor

`PlanExecutor` is responsible for executing the physical DAG.

It does not decide which model should execute a task.

It does not reason about the objective.

It does not evaluate model quality.

Its responsibility is:

> **Execute the plan while respecting its dependency structure.**

The execution loop is conceptually:

```text
Find ready tasks
      │
      ▼
Select execution batch
      │
      ▼
Execute concurrently
      │
      ▼
Record results
      │
      ▼
Find newly-ready tasks
      │
      └──────────────► repeat
```

---

# 12. Concurrency

Independent tasks can execute concurrently.

For:

```text
       A
      / \
     B   C
      \ /
       D
```

the execution is:

```text
       A
       │
   ┌───┴───┐
   ▼       ▼
   B       C
   │       │
   └───┬───┘
       ▼
       D
```

`B` and `C` do not depend on each other.

Therefore they can run simultaneously.

`maxConcurrency` controls how many ready tasks may execute at once.

---

# 13. Dependency Results

When a task depends on previous tasks, their results are made available through the task context.

For:

```text
A → B
```

when `B` executes, its context contains the result of `A`.

Conceptually:

```text
B.context.facts.dependencies = {
  A: <result of A>
}
```

This allows tasks to consume the outputs of previous tasks without coupling the executor directly to their internal output schemas.

---

# 14. Failure Propagation

A failed dependency prevents dependent work from executing.

For example:

```text
A
│
✗ failed
│
▼
B
│
⊘ blocked
│
▼
C
│
⊘ blocked
```

The dependent node is never invoked.

Instead, the task receives a dependency failure result.

This is an important distinction:

```text
failed
```

means:

> The task actually executed and failed.

while:

```text
blocked
```

means:

> The task could not execute because its dependency failed.

---

# 15. ExecutionState

`ExecutionState` represents the lifecycle of every task during execution.

The lifecycle is:

```text
pending
   │
   ├──────────────► blocked
   │
   ▼
running
   │
   ├──────────────► completed
   │
   └──────────────► failed
```

These states describe **execution lifecycle**, not result quality.

That distinction is important.

A `Result` answers:

> What did execution produce?

`ExecutionState` answers:

> What happened to this task?

---

## State meanings

### Pending

The task exists but has not started.

```text
pending
```

### Running

The task has been submitted for execution.

```text
running
```

### Completed

The task executed successfully.

```text
completed
```

The state contains its `Result`.

### Failed

The task executed but produced an unsuccessful result.

```text
failed
```

The state contains its `Result`.

### Blocked

The task could not execute because a dependency failed.

```text
blocked
```

A blocked task does not need to invoke a model node.

---

# 16. Executor

The `Executor` is responsible for actually invoking a model node.

Its responsibility is narrower than `PlanExecutor`.

```text
PlanExecutor
    │
    │ "This task is ready."
    ▼
Executor
    │
    │ "Run it on node X."
    ▼
ModelNode
```

This separation means the executor does not need to understand the entire DAG.

It simply executes a task against a specified node.

---

# 17. ModelNode

A `ModelNode` is an execution resource.

It could represent:

- a local language model
- a remote API
- a specialized model
- a deterministic tool
- a future non-LLM computational worker

The fabric does not fundamentally care.

A node exposes capabilities and an execution interface.

This is what makes heterogeneous execution possible.

---

# 18. Result

A `Result` represents what happened when a task was executed.

Conceptually:

```text
Result
├── taskId
├── success
├── output
├── metadata
└── error?
```

The result belongs to the execution layer.

It is separate from evaluation.

A task can successfully execute and still receive a negative evaluation.

For example:

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

This distinction is fundamental to the replanning architecture.

---

# 19. Evaluator

The evaluator determines whether an execution result is acceptable.

It does not execute tasks.

It does not choose nodes.

It evaluates results.

```text
Result
   │
   ▼
Evaluator
   │
   ▼
Evaluation
```

This allows execution success and semantic correctness to remain separate.

---

# 20. Evaluation and Replanning

After execution, the `Fabric` evaluates the results.

If all evaluations are accepted:

```text
Execute
   │
   ▼
Evaluate
   │
   ▼
Accepted
   │
   ▼
Synthesize
```

If evaluation fails:

```text
Execute
   │
   ▼
Evaluate
   │
   ▼
Rejected
   │
   ▼
Replan
   │
   ▼
Execute again
```

This loop is bounded by `maxAttempts`.

The system therefore supports iterative reasoning without allowing an infinite execution loop.

---

# 21. Fabric

`Fabric` is the orchestration boundary.

It coordinates the major components:

```text
Fabric
│
├── Thinker
├── Planner
├── PlanExecutor
├── AspectRegistry
├── PlanValidator
└── Evaluator
```

It does not implement the internal behavior of these components.

Instead, it coordinates them.

A simplified run is:

```text
plan
 │
 ▼
validate
 │
 ▼
schedule
 │
 ▼
execute
 │
 ▼
evaluate
 │
 ├── accept ──► synthesize
 │
 └── reject ──► replan
```

---

# 22. Why These Components Are Separate

The architecture intentionally separates several concepts that might initially look similar.

## Planner vs PlanExecutor

The planner answers:

> Where should work run?

The plan executor answers:

> When can work run, and execute it respecting dependencies?

---

## TaskGraph vs ExecutionState

The task graph answers:

> What depends on what?

Execution state answers:

> What happened to each task?

For example:

```text
TaskGraph:

A → B → C
```

does not change during execution.

But:

```text
ExecutionState:

A = completed
B = running
C = pending
```

changes continuously.

---

## Result vs Evaluation

A result answers:

> What did the node return?

An evaluation answers:

> Is that result acceptable?

Therefore:

```text
success = true
```

does not necessarily mean:

```text
accepted = true
```

---

## Executor vs ModelNode

The executor controls execution mechanics.

The node performs the actual work.

```text
Executor
   │
   ▼
ModelNode
```

This makes nodes replaceable resources rather than part of the orchestration logic.

---

# 23. A Complete Example

Imagine an objective requiring three pieces of information.

The thinker creates:

```text
Task A: gather requirements

Task B: analyze constraints
  depends on A

Task C: produce recommendation
  depends on A and B
```

The plan becomes:

```text
A
│
▼
B
│
▼
C
```

The planner might assign:

```text
A → local-model
B → reasoning-model
C → high-quality-model
```

The physical plan is therefore:

```text
A → local-model
│
▼
B → reasoning-model
│
▼
C → high-quality-model
```

Execution begins:

```text
A: pending
B: pending
C: pending
```

Then:

```text
A: running
B: pending
C: pending
```

After successful execution:

```text
A: completed
B: pending
C: pending
```

Now `B` becomes ready:

```text
A: completed
B: running
C: pending
```

Eventually:

```text
A: completed
B: completed
C: completed
```

The results are evaluated.

If `C` is judged inadequate:

```text
Evaluate
   │
   ▼
Rejected
   │
   ▼
Thinker.replan()
```

The thinker can create a stronger plan, potentially selecting a different model or adding additional tasks.

---

# 24. Current Architectural Principle

The most important principle in Pi Fabric is:

> **Describe work independently from the resources used to perform it.**

A task should not care which model executes it.

A model should not care how the task was planned.

The planner should not execute the task.

The executor should not evaluate the result.

The evaluator should not decide how the model works.

The thinker should not need to know the details of node execution.

This separation allows each layer to evolve independently.

---

# 25. Current Status

The current implementation includes:

- Task model
- Plan model
- Physical plan
- Model nodes
- Node registry
- Capability discovery
- Execution requirements
- Node selection
- Scheduling policies
- Planner
- Executor
- Retry handling
- Plan executor
- Task graph
- DAG validation
- Cycle detection
- Dependency propagation
- Concurrent execution
- Execution state
- Evaluation
- Replanning
- Fabric orchestration

The test suite currently contains more than 100 passing tests and acts as the primary behavioral safety net for the architecture.

---

# 26. Where We Go Next

The next evolution should build on `ExecutionState`.

Once execution lifecycle is explicit, the system can expose useful information such as:

```text
task-1   completed
task-2   running
task-3   pending
task-4   blocked
```

That creates a foundation for:

- execution events
- progress reporting
- metrics
- tracing
- debugging
- DAG visualization
- execution history
- retry history
- future scheduling decisions

The important thing is that these capabilities can now be added **around the execution model** instead of being mixed into the core orchestration logic.

```

```

## Execution Failure and Recovery

Execution failures are handled at the `Executor` layer.

The runtime distinguishes between **retrying a node** and **failing over to another node**.

A retry occurs when the selected node fails but the configured `RetryPolicy` permits another attempt:

```text
Task
 │
 ▼
Node A
 │
 ├── attempt 1 ──► failure
 │
 ├── attempt 2 ──► failure
 │
 └── attempt 3 ──► success
```

If the node exhausts its retry policy without succeeding, the executor marks that node as attempted and selects another capable node:

```text
Task
 │
 ▼
Node A
 ├── attempt 1 ──► failure
 ├── attempt 2 ──► failure
 └── attempt 3 ──► failure
                    │
                    ▼
                 Node B
                    │
                 attempt 1
                    │
                    ▼
                  success
```

The responsibilities are intentionally separated:

| Component      | Responsibility                                    |
| -------------- | ------------------------------------------------- |
| `RetryPolicy`  | Determines whether another attempt should be made |
| `Executor`     | Performs retries and decides when to fail over    |
| `NodeSelector` | Selects the best capable node                     |
| `ModelNode`    | Performs the actual task execution                |

This produces the following contract:

> **Retry within the selected node first. Fail over only after that node's retry policy has been exhausted.**

A node that eventually succeeds prevents failover to another node.

If all capable nodes are exhausted, the executor returns the final failure result.

### Explicit Node Execution

`Executor.executeOn(task, nodeId)` represents targeted execution.

It:

- resolves the specified node
- applies the retry policy
- returns the resulting `Result`

It does **not** perform node selection or failover.

`Executor.execute(task)` is the higher-level operation responsible for:

1. discovering capable nodes
2. selecting a node
3. executing with retries
4. excluding exhausted nodes
5. failing over to another capable node
6. returning success or the final failure

This distinction keeps targeted execution predictable while allowing normal execution to be resilient.

### Execution Lifecycle

`PlanExecutor` operates above `Executor`.

Its responsibility is to coordinate tasks according to the dependency graph:

```text
PlanExecutor
     │
     ▼
 TaskGraph
     │
     ├── ready tasks
     │
     ▼
 Executor
     │
     ├── retry
     ├── failover
     └── Result
     │
     ▼
ExecutionState
     │
     └── current lifecycle state

ExecutionHistory
     │
     └── chronological events
```

This separation means a node failure remains an execution concern, while dependency propagation remains a DAG orchestration concern.

For example:

```text
A ── failed
│
▼
B ── blocked
```

`Executor` determines that `A` failed.

`PlanExecutor` determines that `B` cannot execute because its dependency failed.

`ExecutionState` records `A` as `failed` and `B` as `blocked`.

`ExecutionHistory` records the events that occurred during the execution.

This separation is a core architectural boundary in Pi Fabric.
