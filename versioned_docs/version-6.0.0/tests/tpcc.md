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
| `tpcc/tx` | Ordered SQL in driver transactions | PostgreSQL, MySQL, Picodata (`none`), YDB |
| `tpcc/procs` | One stored procedure call per transaction | PostgreSQL, MySQL |

```bash
stroppy run tpcc/tx -d pg \
  --scale-factor 10 \
  --executor constant-vus --vus 32 --duration 5m

stroppy run tpcc/procs -d mysql \
  --scale-factor 10 --iterations 100
```

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

## Scale and initial population

`--scale-factor` is integer warehouse count `W` (legacy environment alias
`WAREHOUSES`).

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
| `--retry-attempts` | `3` | Maximum transaction attempts. |
| `--pg-unlogged` | `false` | Opt into PostgreSQL unlogged loading. |
| `--tx-isolation` | driver-derived | Isolation override. |
| `--sql-file` | selected dialect | SQL override. |

Shared flags: `--executor`, `--vus`, `--iterations`, `--duration`, and
`--query-timeout`.

Default isolation:

| Driver | Isolation |
|---|---|
| PostgreSQL | `repeatable_read` |
| MySQL | `repeatable_read` |
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

Each VU is pinned to a home warehouse inside its configured slice. Remote
warehouse choices stay inside that slice. Population validation scopes
warehouse-dependent checks to the same range.

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
| `workload` | Execute measured five-transaction mix. |

A population mismatch is structural and makes the command exit nonzero.

Load then measure:

```bash
stroppy run tpcc/tx -d pg --scale-factor 10 --load-workers 8 \
  --no-steps workload

stroppy run tpcc/tx -d pg --scale-factor 10 \
  --executor constant-vus --vus 64 --duration 10m \
  --steps workload
```

## SQL assets

| Driver | `tx` | `procs` |
|---|---|---|
| PostgreSQL | `workloads/tpcc/pg.sql` | same asset |
| MySQL | `workloads/tpcc/mysql.sql` | same asset |
| Picodata | `workloads/tpcc/pico.sql` | unsupported |
| YDB | `workloads/tpcc/ydb.sql` | unsupported |

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

Core transaction/query/terminal-error metrics are described in
[Reports & Workflow](../reports-workflow).

## Retry and continuation

TPC-C retries classified serialization, deadlock, lock-timeout, and selected
transient errors up to `--retry-attempts`. A successful retry is counted without
failing the iteration. A terminal nonfatal error fails one iteration, lets the
VU continue, and appears in final error summary while command exits `0`.

## Integration coverage

```bash
make tmpfs-up
make build
make integration
make tmpfs-down
```

Reference implementation:

- [`workloads/tpcc` at v6.0.0](https://github.com/stroppy-io/stroppy/tree/v6.0.0/workloads/tpcc)
