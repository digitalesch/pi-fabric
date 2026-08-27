````md
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
   │ Plan
   ▼
 Planner
   │
   ├── AspectRegistry
   ├── NodeSelector
   │      └── SchedulingPolicy
   │
   ▼
PhysicalPlan
   │
   ▼
TaskGraph
   │
   ▼
PlanExecutor
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
   ├── accept → Synthesize
   │
   └── reject → Replan
````

## Core Concepts

### Thinker

The `Thinker` is responsible for high-level reasoning around an objective.

It can:

* create an initial plan
* evaluate execution results
* replan after failed evaluation
* synthesize the final result

```ts
interface Thinker {
  plan(objective: Objective): Promise<Plan>;

  evaluate(
    objective: Objective,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<EvaluationDecision>;

  replan(
    objective: Objective,
    previousPlan: Plan,
    results: Result[],
    evaluations: Evaluation[],
  ): Promise<Plan>;

  synthesize(
    objective: Objective,
    results: Result[],
  ): Promise<string>;
}
```

### Task

A task represents a logical unit of work.

Tasks describe:

* what aspect they address
* their input
* contextual information
* expected output
* dependencies
* execution requirements

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

This keeps DAG semantics out of the executor itself.

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

Nodes advertise their capabilities so the fabric can select an appropriate node for each task.

A capability describes:

```ts
interface Capability {
  aspect: string;
  quality: number;
  contextWindow: number;
  latencyMs?: number;
  local: boolean;
}
```

This allows the same task to potentially be executed by different models.

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

and then selects the highest-quality capable node.

This separation allows additional scheduling policies to be introduced without changing the planner or executor.

### Planner

The `Planner` converts a logical `Plan` into a `PhysicalPlan`.

For every task it:

1. finds nodes capable of handling the task aspect
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

### PlanExecutor

`PlanExecutor` executes a physical plan while respecting task dependencies.

It uses `TaskGraph` to determine which tasks are ready to execute.

Independent tasks can execute concurrently, subject to `maxConcurrency`.

For example:

```text
       A
      / \
     B   C
      \ /
       D
```

`B` and `C` can execute concurrently once `A` completes.

The executor also propagates dependency failures:

```text
A ── failed
│
▼
B ── blocked
```

A blocked task is not sent to its model node.

### Executor

`Executor` handles execution against a specific node.

It is responsible for:

* looking up nodes
* executing tasks
* retrying failed execution when configured
* converting thrown node errors into `Result`s

Node selection is intentionally outside this class.

### Evaluator

The evaluator assesses individual execution results.

Its output is represented by an `Evaluation` containing:

* task ID
* acceptance status
* issues

The fabric uses these evaluations to determine whether the overall execution should be accepted or replanned.

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
  └── rejected ─► Replan
                    │
                    └──► Execute again
```

The fabric limits the number of execution/replanning attempts to prevent unbounded loops.

## Testing

The project currently has extensive coverage across the runtime components, including:

* node selection
* scheduling policies
* planning
* execution
* retries
* dependency handling
* DAG validation
* cycle detection
* concurrency
* evaluation and replanning
* fabric orchestration

The test suite currently contains **109 passing tests**.

Run the suite with:

```bash
npm test
```

## Design Principles

Pi Fabric is being built around a few core principles.

### Separation of concerns

Planning, scheduling, execution, evaluation, and orchestration should remain independently replaceable.

### Capability-driven execution

Tasks should describe what they need rather than which model should execute them.

### Policy-driven scheduling

Node selection should be configurable through scheduling policies.

### DAG-native execution

Dependencies are first-class objects rather than incidental executor logic.

### Model heterogeneity

Different tasks can be assigned to different models based on their capabilities and requirements.

### Test-driven architecture

New abstractions are introduced through explicit behavioral contracts and tested before being integrated into the execution path.

## Current Status

Pi Fabric currently has the following major pieces in place:

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
* [x] Evaluator
* [x] Thinker interface
* [x] Evaluation/replanning loop
* [x] Fabric orchestration
* [x] Comprehensive runtime test coverage

### Next

The next architectural step is to make execution state observable and explicit.

This will allow the fabric to represent task lifecycle state such as:

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

This will provide a foundation for execution observability, metrics, debugging, DAG visualization, and eventually richer scheduling behavior.

```
```
