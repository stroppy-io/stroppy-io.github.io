---
sidebar_position: 6
title: Transactions & Errors
description: Isolation, retry policy, terminal errors, metrics, and cancellation in Stroppy v6
---

# Transactions & Errors

Transactional workloads in Stroppy v6 are implemented in Go. Users choose a
registered variant, driver, executor, and optional isolation override; workload
code owns transaction boundaries and retry policy.

## Transaction variants

| Workload | Model | Drivers |
|---|---|---|
| `tpcb/tx` | Ordered DML inside a driver transaction | PostgreSQL, MySQL, Picodata (`none`), YDB |
| `tpcb/procs` | One server-side procedure call per iteration | PostgreSQL, MySQL |
| `tpcc/tx` | Five TPC-C transaction bodies as ordered DML | PostgreSQL, MySQL, Picodata (`none`), YDB |
| `tpcc/procs` | One stored procedure per selected TPC-C transaction | PostgreSQL, MySQL |

```bash
stroppy run tpcc/tx -d pg \
  --executor constant-vus --vus 32 --duration 5m

stroppy run tpcc/procs -d mysql \
  --executor shared-iterations --iterations 100
```

## Isolation levels

| Name | Meaning |
|---|---|
| `read_uncommitted` | Lowest standard SQL isolation. |
| `read_committed` | Each statement sees committed rows. |
| `repeatable_read` | Stable transaction snapshot where supported. |
| `serializable` | Highest standard isolation. |
| `db_default` | Backend default. |
| `conn` | Dedicated connection without issuing `BEGIN`; commit/rollback release it. |
| `none` | No transaction and no pinned connection; queries use pool directly. |

Override a workload default:

```bash
stroppy run tpcb/tx -d pg --tx-isolation serializable
stroppy run tpcc/tx -d pico --tx-isolation none
```

V6 defaults:

| Workload family | PostgreSQL | MySQL | Picodata | YDB |
|---|---|---|---|---|
| TPC-B | `read_committed` | `read_committed` | `none` | `serializable` |
| TPC-C | `repeatable_read` | `repeatable_read` | `none` | `serializable` |

Picodata's driver does not implement `Begin`, so `none` is required for its
portable transaction-shaped workload paths.

## `conn` and `none`

`conn` is useful when several statements need one session without database
transaction semantics. Drivers acquire one connection and release it on commit
or rollback.

`none` keeps the workload's transaction-shaped control flow but sends each query
through the pool independently. Commit and rollback are no-ops. It does **not**
provide atomicity.

## Retry policy

Drivers classify backend errors into shared facts. Transactional workloads build
a policy from those facts rather than matching backend messages.

Default retry categories:

- serialization conflict;
- deadlock;
- lock timeout;
- unconditional transient failure.

Conditional transient failures are retried only for operations marked
idempotent. Unknown errors are returned.

`--retry-attempts` sets the maximum total attempts for TPC-B and TPC-C:

```bash
stroppy run tpcc/tx --retry-attempts 5
```

A scheduled retry increments retry metrics. If a later attempt succeeds, the
iteration succeeds and the run is not marked as completed with errors.

## Terminal nonfatal errors

When retries are exhausted or policy returns a nonfatal error:

- one transaction iteration fails;
- its VU continues with the next iteration;
- bounded WARN records identify operation and error class;
- counters record terminal error and failed iteration;
- final output includes `bench completed with errors`;
- process exits `0`.

Query-set workloads (TPC-H, TPC-DS, and direct SQL) similarly count a failed
query and continue with the next query when the error is nonfatal.

This exit behavior lets a long stress run finish and report aggregate failure
rates. CI that requires zero terminal errors should gate on summary counters or
the final marker, not exit status alone.

## Fatal and structural errors

These remain nonzero:

- invalid command/config/parameter input;
- setup or validation failure;
- workload teardown or driver teardown failure;
- explicit fatal workload policy;
- unrecoverable engine error.

Fatal policy stops the scenario and reports the error once.

TPC-H/TPC-DS reference-answer differences remain diagnostic. They are logged
without changing exit status.

## Cancellation

First SIGINT or SIGTERM cancels the scenario, propagates context cancellation to
queries and load workers, then runs teardown.

| Event | Exit status |
|---|---:|
| Graceful SIGINT | 130 |
| Graceful SIGTERM | 143 |
| Second signal, forced exit | 2 |

Cancellation is not counted as a terminal benchmark error.

## Transaction metrics

Core native metrics include:

| Metric | Instrument | Meaning |
|---|---|---|
| `transactions_total` | counter | Transactions observed. |
| `tx_total_duration` | histogram (ms) | Wall-clock transaction duration. |
| `tx_commits_total` | counter | Successful commits. |
| `tx_errors_total` | counter | Transaction errors. |
| `tx_queries_per_tx` | histogram | Query count per transaction. |
| `retry_attempts_total` | counter | Scheduled retries. |
| `failed_iterations_total` | counter | Terminal failed iterations. |
| `terminal_errors_total` | counter | Terminal transaction/query errors. |

Individual query operations also update `run_query_operations_total`,
`run_query_errors_total`, and `run_query_duration`.

Metrics carry bounded attributes such as step, transaction name, isolation,
action, error class, table, and progress event where relevant. OTLP export adds
the configured prefix (`stroppy_` by default).

## Two-pass benchmark workflow

Load once:

```bash
stroppy run tpcc/tx -d pg --scale-factor 50 --load-workers 16 \
  --no-steps workload
```

Measure only:

```bash
stroppy run tpcc/tx -d pg --scale-factor 50 \
  --executor constant-vus --vus 64 --duration 1h \
  --steps workload
```

This keeps load time out of the transaction throughput interval.

## Driver authoring interface

Go workloads call `Bench.Begin` with a `BeginOpts` isolation/name and use the
returned query API. Drivers implement:

```go
type Tx interface {
    RunQuery(context.Context, string, map[string]any) (*QueryResult, error)
    Commit(context.Context) error
    Rollback(context.Context) error
    Isolation() config.TxIsolationLevel
}
```

Drivers also implement `ClassifyError(error) ErrorFacts`; workloads decide what
to retry, return, ignore, or mark fatal. See [Extensibility](./extensibility).
