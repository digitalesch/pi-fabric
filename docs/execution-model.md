# Pi Fabric Execution Model

Pi Fabric separates logical planning from physical execution.

The central execution pipeline is:

```text
Objective
    │
    ▼
Thinker
    │
    ▼
Plan
    │
    ▼
Planner
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
    ├── accepted
    │
    └── rejected
            │
            ▼
          Replan
```

---

## Logical vs Physical Planning

A logical `Task` describes work without selecting an execution resource.

```text
Logical Task
    │
    │ aspect + requirements
    ▼
Planner
    │
    ├── NodeRegistry
    ├── AspectRegistry
    └── NodeSelector
            │
            ▼
      SchedulingPolicy
            │
            ▼
Physical Task
```

The logical plan answers:

> **What work needs to happen?**

The physical plan answers:

> **Where will that work happen?**

This distinction allows the same plan to be executed against different node configurations.

---

## Task Dependencies

Dependencies are represented explicitly through `TaskGraph`.

For:

```text
A
├── B
└── C
    └── D
```

the graph determines which tasks are eligible to execute.

A task becomes ready when all of its dependencies have completed successfully.

Independent tasks may execute concurrently.

---

## Dependency Failure

A dependency failure prevents dependent tasks from executing.

```text
A ── failed
│
├──► B ── blocked
│
└──► C ── blocked
```

Blocked tasks are recorded in execution state and history but are never submitted to a model node.

This prevents the runtime from executing work whose prerequisites have failed.

---

## Concurrency

`PlanExecutor` can execute independent ready tasks concurrently.

Concurrency is bounded by `maxConcurrency`.

Conceptually:

```text
             A
          /     \
         B       C
          \     /
             D
```

After `A` completes:

```text
B ─────────►
             │
             ▼
            D
             ▲
             │
C ─────────►
```

`B` and `C` can run simultaneously.

`D` cannot begin until both are complete.

---

## Execution Lifecycle

Each task has an explicit lifecycle:

```text
pending
   │
   ├──► blocked
   │
   ▼
running
   │
   ├──► completed
   │
   └──► failed
```

Transitions are validated by `ExecutionState`.

Invalid transitions are rejected rather than silently changing state.

For example:

```text
completed → running
```

is invalid.

This makes runtime state transitions deterministic and testable.

---

## Node Execution

`Executor` receives a task and a selected node.

```text
Executor
   │
   ▼
ModelNode.execute(task)
   │
   ▼
Result
```

The executor does not decide which node should execute the task.

That responsibility belongs to:

```text
NodeSelector
```

This keeps resource selection independent from execution mechanics.

---

## Retry

Retries are controlled by `RetryPolicy`.

A temporary failure can produce:

```text
attempt 1
   │
   ▼
failure
   │
   ▼
retry
   │
attempt 2
   │
   ▼
success
```

Execution history records retry activity explicitly.

If retries are exhausted, the executor can return the failure and allow higher-level execution logic to attempt another candidate node.

---

## Node Failover

When multiple capable nodes are available, `Executor` can attempt candidates sequentially.

Conceptually:

```text
Task
 │
 ▼
Node A
 │
 └── failure
      │
      ▼
Node B
 │
 └── success
```

Retries are exhausted on a node before moving to another candidate.

This gives the runtime two levels of resilience:

```text
Retry
  │
  └── recover transient failures on the same node

Failover
  │
  └── recover by using another capable node
```

---

## Result vs Evaluation

Execution success does not imply semantic acceptance.

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

The node reports whether execution itself succeeded.

The evaluator determines whether the produced result satisfies the required criteria.

This distinction allows a successful execution to trigger replanning.

---

## Replanning

The high-level orchestration loop can therefore be:

```text
Think
 │
 ▼
Plan
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
                       └──► Execute
```

The number of replanning attempts is bounded to prevent infinite execution loops.

---

## Runtime Introspection

Execution is accompanied by explicit runtime information:

```text
ExecutionState
    │
    └── current state

ExecutionHistory
    │
    └── chronological events

ExecutionSnapshot
    │
    └── aggregate state

ExecutionMetrics
    │
    └── quantitative summary

CriticalPath
    │
    └── dependency-chain analysis
```

These components are deliberately separated from the execution algorithm.

The execution model therefore remains deterministic while consumers can inspect:

- what is currently running
- what has completed
- what failed
- what was blocked
- how long tasks took
- how often retries occurred
- which dependency chain dominated execution

---

## Architectural Boundary

The most important boundary in Pi Fabric is:

```text
                    LOGICAL
                      │
              ┌───────▼───────┐
              │    Thinker    │
              └───────┬───────┘
                      │
                   Plan
                      │
              ┌───────▼───────┐
              │    Planner    │
              └───────┬───────┘
                      │
                  Physical
                      │
              ┌───────▼───────┐
              │ PlanExecutor  │
              └───────┬───────┘
                      │
                   Runtime
                      │
              ┌───────▼───────┐
              │    Executor   │
              └───────┬───────┘
                      │
                  Resource
                      │
              ┌───────▼───────┐
              │   ModelNode   │
              └───────────────┘
```

Planning determines **what should happen**.

Scheduling determines **where it should happen**.

Execution determines **how it runs**.

Evaluation determines **whether the result is acceptable**.

Observability determines **what can be understood about the run**.

Keeping these boundaries explicit is what allows Pi Fabric to scale from a simple local runtime into a heterogeneous execution system without making individual models responsible for orchestration.

```

```
