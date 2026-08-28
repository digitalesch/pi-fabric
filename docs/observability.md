# Pi Fabric Observability

Pi Fabric treats execution observability as a runtime concern separate from execution mechanics.

The runtime currently exposes four complementary views of an execution:

```text
ExecutionState
      │
      ├── current lifecycle
      │
      ▼
ExecutionSnapshot
      │
      ├── aggregate state
      │
      ▼
ExecutionHistory
      │
      ├── chronological events
      │
      ▼
ExecutionMetrics
      │
      └── quantitative summary
```

Critical-path analysis provides an additional graph-level view.

---

## Execution State

`ExecutionState` represents the current state of every task.

A task moves through:

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

The state records:

- task ID
- status
- start timestamp
- completion timestamp
- execution duration
- result

State is mutable runtime information.

It answers:

> **What is true right now?**

---

## Execution Snapshot

`ExecutionSnapshot` provides an aggregate, read-oriented representation of execution state.

It includes:

```text
total
pending
running
completed
failed
blocked
finished
durationMs
executions
```

This allows consumers to inspect execution progress without directly depending on the internal `Map` used by `ExecutionState`.

For example:

```text
total:     5
pending:   1
running:   1
completed: 2
failed:    1
blocked:   0
finished:  false
```

Snapshots are useful for:

- progress reporting
- dashboards
- CLI output
- orchestration decisions
- API responses

---

## Execution History

`ExecutionHistory` records chronological execution events.

Supported events include:

```text
task_started
task_completed
task_failed
task_blocked
task_retrying
```

Events can contain:

```text
type
taskId
timestamp
nodeId
attempt
result
```

History answers:

> **What happened?**

For example:

```text
task_started      task-1   attempt 1
task_retrying     task-1   attempt 2
task_started      task-1   attempt 2
task_completed    task-1   attempt 2
```

This differs fundamentally from state.

The final state may simply be:

```text
task-1 → completed
```

while history explains how it got there.

---

## Execution Metrics

Metrics are derived from the snapshot and history.

Current metrics include:

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

### Success Rate

Success rate is calculated over finished tasks:

```text
successRate =
    completedTasks /
    (completedTasks + failedTasks)
```

If no tasks have finished, the success rate is `0`.

Blocked tasks are not treated as completed or failed for this calculation.

---

## Duration

Each completed or failed task records:

```text
startedAt
completedAt
durationMs
```

Task duration is calculated as:

```text
durationMs =
    completedAt - startedAt
```

The aggregate execution metrics then calculate:

```text
totalDurationMs
averageDurationMs
```

Only tasks with recorded durations contribute to these metrics.

---

## Retry Observability

Retries are represented explicitly in execution history.

A retry sequence can look like:

```text
task_started
task_retrying
task_started
task_retrying
task_started
task_completed
```

The `attempt` field identifies which execution attempt is being represented.

This makes retry behavior observable without requiring consumers to infer retries from timestamps or duplicate task-start events.

Retry history is useful for:

- diagnosing unstable nodes
- measuring retry frequency
- evaluating retry policies
- understanding execution latency
- future load-aware scheduling

---

## Critical Path

Critical-path analysis combines:

```text
TaskGraph
+
ExecutionSnapshot
```

to determine the longest dependency chain by cumulative execution duration.

For:

```text
      A
     / \
    B   C
     \ /
      D
```

the algorithm evaluates each dependency chain and identifies the chain with the greatest cumulative duration.

For example:

```text
A = 10ms
B = 30ms
C = 5ms
D = 10ms

A → B → D = 50ms
A → C → D = 25ms
```

The critical path is:

```text
A → B → D
```

### Zero-Duration Tasks

Zero-duration tasks are still part of the dependency path.

For:

```text
A = 0ms
B = 10ms
C = 0ms

A → B → C
```

the result is:

```text
taskIds: ['A', 'B', 'C']
durationMs: 10
```

The path represents dependency structure, while duration represents cumulative execution cost.

When multiple paths have equal duration, the runtime prefers the path containing more tasks. This preserves connected zero-duration tasks instead of arbitrarily removing them.

### Cycle Protection

Critical-path calculation detects cycles while traversing dependencies.

A cycle results in an explicit error rather than infinite recursion.

This provides a second layer of protection in addition to `TaskGraph` validation.

---

## Observability Boundaries

The runtime intentionally keeps observability outside the core execution algorithm.

```text
                 Execution
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
        State     History   Result
          │         │
          └────┬────┘
               ▼
            Metrics
               │
               ▼
         Critical Path
```

This means future integrations can consume runtime information without modifying task execution semantics.

Potential consumers include:

- CLI progress displays
- web dashboards
- structured logs
- tracing systems
- metrics backends
- execution replay tools
- DAG visualizers

---

## Future Direction

The current observability layer is intentionally lightweight and in-memory.

Potential future capabilities include:

### Timeline

Convert execution events into a chronological timeline:

```text
0ms   task A started
12ms  task A completed
13ms  task B started
13ms  task C started
42ms  task B completed
51ms  task C completed
```

### Task Inspection

Expose a task-centric view:

```text
Task
 ├── status
 ├── node
 ├── attempts
 ├── duration
 ├── result
 └── events
```

### DAG Visualization

Combine:

```text
TaskGraph
+
ExecutionState
+
ExecutionHistory
```

to visualize both dependency structure and runtime progress.

### Scheduling Feedback

Metrics and history can eventually feed scheduling decisions:

```text
ExecutionHistory
      │
      ▼
Node performance
      │
      ▼
SchedulingPolicy
      │
      ▼
NodeSelector
```

This creates a path toward adaptive scheduling without coupling the scheduler directly to execution internals.

---

## Design Principle

Observability should answer:

> **What happened, when did it happen, how long did it take, and where did it happen?**

It should not determine:

> **What should the task do?**

That remains the responsibility of planning and orchestration.

```

```
