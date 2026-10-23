---
sidebar_position: 2
title: TPC-C
sidebar_label: TPC-C
description: TPC-C workload model, variants, distributed loading, compliance report, and metrics in Stroppy v6
---

# TPC-C

TPC-C is Stroppy's mixed OLTP workload. It loads warehouses, districts,
customers, orders, stock, and items, then runs the standard 45/43/4/4/4
transaction mix.

Use it to evaluate:

- throughput and tail latency under contention;
- lock, deadlock, and serialization behavior;
- retry rates;
- connection-pool scaling;
- primary/secondary index performance;
- client round-trip cost versus stored procedures.

## Variants

| Workload | Execution | Drivers |
|---|---|---|
| `tpcc/tx` | Ordered SQL in driver transactions | PostgreSQL, MySQL, CockroachDB, YugabyteDB, TiDB, Picodata (`none`), YDB |
| `tpcc/procs` | One stored procedure call per transaction | PostgreSQL, MySQL |

```bash
stroppy run tpcc/tx -d pg \
  --scale-factor 10 \
  --executor constant-vus --vus 32 --duration 5m

stroppy run tpcc/procs -d mysql \
  --scale-factor 10 --iterations 100
```

Use `-d crdb`, `-d yugabyte`, or `-d tidb` for the corresponding engine's
client-side `tx` path. Procedures are supported on PostgreSQL/MySQL only.
**v6.2.0 limitation:** `tpcc/procs -d tidb` is accepted before setup but can panic
on missing procedure queries. Use `tpcc/tx -d tidb` instead
([#219](https://github.com/stroppy-io/stroppy/issues/219)).

## Transaction mix

| Transaction | Target share | Work |
|---|---:|---|
| New-Order | 45% | Create order/order lines, update district and stock, exercise required invalid-item rollback. |
| Payment | 43% | Update warehouse, district, customer, and history. |
| Order-Status | 4% | Read customer, latest order, and order lines. |
| Delivery | 4% | Process oldest new order in each district and update balances. |
| Stock-Level | 4% | Count low-stock items from recent orders. |

Without pacing, Stroppy drives raw throughput. `--pacing=true` adds TPC-C keying
and think times to both `tx` and `procs`.

![The essence of TPC-C: 88% of transactions update one of ten district rows per warehouse](/img/tpcc-essence.svg)

The mix and the schema together explain the shape of the load. New-Order and Payment
both update a district row, and there are only ten of those per warehouse — so most of
a run is queueing on a handful of rows, and throughput is decided by how fast they can
be updated in turn. The two read-only transactions are 8% of the mix, and one of them
reads the same district row.

## Scale and initial population

`--scale-factor` is integer warehouse count `W`, also available as
`--warehouses` and through process environment `SCALE_FACTOR`/`WAREHOUSES`.

| Table | Rows |
|---|---:|
| `warehouse` | `W` |
| `district` | `10 × W` |
| `customer` | `30,000 × W` |
| `item` | 100,000 global rows |
| `stock` | `100,000 × W` |
| `orders` | `30,000 × W` |
| `order_line` | `300,000 × W` initial fixed mean |
| `new_order` | `9,000 × W` |
| `history` | 0; grows during Payment |

Population generation preserves NURand surnames, per-district customer
permutations, decimal scales, credit/delivery splits, fixed-width fields, and
ORIGINAL markers. Initial order lines use ten rows per order; measured
New-Order transactions choose 5–15.

## Parameters

| Flag | Default | Meaning |
|---|---|---|
| `--scale-factor` | `1` | Warehouse count. |
| `--warehouse-start` | `1` | First warehouse ID in distributed slice. |
| `--load-items` | contextual | Load global item table; true by default only at warehouse 1. |
| `--load-workers` | `1` | Workers per table load. |
| `--pacing` | `false` | Apply keying and think times. |
| `--spread-warehouses` | `false` | Choose a home warehouse for each logical transaction from the configured slice. |
| `--warmup` | `0s` | Unmeasured traffic before `workload`; requires `constant-vus`. |
| `--retry-attempts` | `3` | Maximum transaction attempts. |
| `--pg-unlogged` | `false` | Opt into PostgreSQL unlogged loading. |
| `--tx-isolation` | driver-derived | Isolation override. |
| `--sql-file` | selected dialect | SQL override. |

Shared flags: `--executor`, `--vus`, `--iterations`, `--duration`, `--drain-timeout` (default `30s`; `none` waits without a deadline), and
`--query-timeout`. Boolean flags require explicit values, such as `--pacing=true`.

Default isolation:

| Driver | Isolation |
|---|---|
| PostgreSQL | `repeatable_read` |
| MySQL | `repeatable_read` |
| CockroachDB | `serializable` |
| YugabyteDB | `read_committed` |
| TiDB | `repeatable_read` |
| Picodata | `none` |
| YDB | `serializable` |

## Distributed warehouse loading

Several Stroppy processes can load disjoint ranges:

```bash
# Schema, item table, warehouses 1..100.
stroppy run tpcc/tx -d pg --warehouse-start 1 --scale-factor 100 \
  --steps drop_schema,create_schema,load_data,validate_population

# Warehouses 101..200; item table is skipped by contextual default.
stroppy run tpcc/tx -d pg --warehouse-start 101 --scale-factor 100 \
  --steps load_data,validate_population
```

By default, each VU is pinned to a home warehouse inside its configured slice.
With `--spread-warehouses=true`, every logical transaction chooses its home
uniformly from that slice, retaining the choice across retries. This lets a small
VU count exercise many warehouses independently of concurrency, but is not the
fixed-terminal TPC-C model. Remote warehouse choices stay inside the slice and
exclude the current home. Population validation scopes warehouse-dependent checks
to the same range.

On YDB, create schema once using total warehouse count so generated partition
keys cover all loaders. Subsequent processes should skip schema creation.

## Steps

| Step | Meaning |
|---|---|
| `drop_schema` | Remove tables and routines. |
| `create_schema` | Create nine tables; render YDB partition keys in Go. |
| `create_procedures` | Create procedures for `tpcc/procs`. |
| `set_unlogged` | Opt-in PostgreSQL pre-load transition. |
| `load_data` | Load eight populated tables; history stays empty. |
| `create_indexes` | Create customer-name/order indexes after load. |
| `set_logged` | Restore PostgreSQL durability after unlogged load. |
| `create_foreign_keys` | Add PostgreSQL/MySQL references after logging. |
| `analyze` | Refresh PostgreSQL/MySQL planner statistics. |
| `validate_population` | Run cardinality and TPC-C consistency checks. |
| `warmup` | Optional unmeasured traffic when `--warmup` is positive. |
| `workload` | Execute measured five-transaction mix. |

A population mismatch is structural and makes the command exit nonzero. Transient
validation read failures are retried within `--retry-attempts`; the separate
`tpcc_population_retry_attempts` counter records these setup retries.

Load then measure:

```bash
stroppy run tpcc/tx -d pg --scale-factor 10 --load-workers 8 \
  --no-steps workload

stroppy run tpcc/tx -d pg --scale-factor 10 \
  --executor constant-vus --vus 64 --duration 10m \
  --steps workload
```

## Warmup and measurement

To warm up existing data before a timed measurement:

```bash
stroppy run tpcc/tx -d pg --scale-factor 10 \
  --executor constant-vus --vus 64 --warmup 5m --duration 30m \
  --steps warmup,workload
```

`--duration` remains the measured workload duration. Warmup uses the same mix,
VUs, random state, and history ID counter, but its traffic is excluded from the
TPC-C measurement report. Generic metrics retain both phases under
`step=warmup` and `step=workload`. `--steps workload` excludes warmup even when
`--warmup` is set. Each phase has its own drain, so elapsed time can exceed
warmup plus duration. Workers activate immediately at each phase boundary;
warmup does not by itself guarantee steady state.

History IDs initialize above the existing table maximum, so sequential traffic
runs can reuse a dataset without truncating `history`. Independent concurrent
traffic processes must not share that history ID space: maximum-based
initialization does not reserve ranges across processes. This does not prevent
distributed loading of disjoint warehouse slices.

Pacing is a TPC-C-style stress profile, not an audited TPC-C result. Strict
terminal/district and deferred Delivery behavior remain tracked in
[#193](https://github.com/stroppy-io/stroppy/issues/193).

## SQL assets

| Driver | `tx` | `procs` |
|---|---|---|
| PostgreSQL | `workloads/tpcc/pg.sql` | same asset |
| MySQL | `workloads/tpcc/mysql.sql` | same asset |
| CockroachDB | `workloads/tpcc/crdb.sql` | unsupported |
| YugabyteDB | `workloads/tpcc/pg.sql` | unsupported |
| TiDB | `workloads/tpcc/tidb.sql` | unsupported; see v6.2.0 warning above |
| Picodata | `workloads/tpcc/pico.sql` | unsupported |
| YDB | `workloads/tpcc/ydb.sql` | unsupported |

Engine presets select the embedded asset automatically; `--sql-file` takes a
file on disk. `crdb24.sql` is an alternate CockroachDB 24.1 asset; to select it,
use the positional embedded override `tpcc/crdb24` or a local file path.
`--pg-unlogged` applies only to PostgreSQL.

`ydb_no_indexes.sql` is an embedded comparison schema. Local override example:

```bash
stroppy run tpcc/tx ./workloads/tpcc/ydb_no_indexes.sql -d ydb
```

## Metrics and report

TPC-C adds:

- per-transaction attempt counters;
- per-transaction duration histograms;
- transaction mix observations;
- required rollback decisions/completions;
- remote New-Order line and Payment observations;
- by-name and bad-credit selections;
- retry counter.

The final report gives count, mix, throughput, and p50/p90/p95/p99 response
time for every transaction type. Paced runs additionally receive TPC-C §5.2.5
response-time and mix verdicts, statistical-validity status, and steady-state
assessment. Unpaced runs mark compliance not applicable.

Duration histograms add `phase=warmup|measurement|drain` and
`outcome=success|error|canceled`, based on completion time. The TPC-C report
counts successful measured completions separately from failures, drain, and
cancellations. Latency and mix still include failed measured operations; filter
exported metrics by step and phase when comparing runs. Generic native TPS uses
its executor wall-clock window, including actual drain, so it is not the same
as the TPC-C measured-completion rate.

The latency scopes differ:

- `tpcc_<transaction>_duration`: logical database operation, including pool
  acquisition and retries, excluding keying/think time;
- `tx_total_duration`: one transaction attempt;
- `iteration_duration`: the full iteration, including pacing and retries.

Reports are saved automatically. `--report-html run.html` writes a standalone
view; see [Reports & Workflow](../reports-workflow) for captures and comparisons.

Core transaction/query/terminal-error metrics are described in
[Reports & Workflow](../reports-workflow).

## Retry and continuation

TPC-C retries classified serialization, deadlock, lock-timeout, and selected
transient errors up to `--retry-attempts`. A successful retry is counted without
failing the iteration. A terminal nonfatal error fails one iteration, lets the
VU continue, and appears in final error summary while command exits `0`.

Keying and think waits observe cancellation. Thinking occurs once after the
logical transaction's retries, including after nonfatal failure. Interrupting
post-transaction thinking preserves an already successful transaction. The
required invalid-item rollback counts as success only after rollback succeeds;
unknown rollback outcomes remain errors.

## Integration coverage

```bash
make tmpfs-up
make build
make integration
make tmpfs-down
```

Reference implementation:

- [`workloads/tpcc` at v6.2.0](https://github.com/stroppy-io/stroppy/tree/v6.2.0/workloads/tpcc)
