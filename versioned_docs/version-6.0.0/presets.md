---
sidebar_position: 7
title: Built-in Workloads
description: Registered Stroppy v6 workloads, typed parameters, steps, and supported drivers
---

# Built-in Workloads

Stroppy v6 compiles workload implementations and their assets into one binary.
No workspace generation is required.

```bash
stroppy run simple
stroppy run tpcb/tx
stroppy run tpcb/procs
stroppy run tpcc/tx
stroppy run tpcc/procs
stroppy run tpch/tx
stroppy run tpcds
stroppy run ./queries.sql
```

## Catalog

| Workload | Purpose | Drivers |
|---|---|---|
| `simple` | Small create/load/read/drop smoke | SQL drivers with row results |
| `tpcb/tx` | TPC-B client-side transaction | PostgreSQL, MySQL, Picodata, YDB |
| `tpcb/procs` | TPC-B stored procedure | PostgreSQL, MySQL |
| `tpcc/tx` | TPC-C five-transaction mix | PostgreSQL, MySQL, Picodata, YDB |
| `tpcc/procs` | TPC-C stored procedures | PostgreSQL, MySQL |
| `tpch/tx` | TPC-H load plus q1–q22 | PostgreSQL, MySQL, Picodata, YDB |
| `tpcds` | TPC-DS load plus query suite | PostgreSQL, MySQL, YDB; Picodata load-only |
| `execute_sql` | SQL file or inline SQL | SQL query drivers |

Discover exact schemas and embedded assets:

```bash
stroppy probe
stroppy probe -o json
stroppy run tpcc/tx --help
```

## Shared executors

All registered workloads accept:

| Flag | Default | Meaning |
|---|---|---|
| `--executor` | `shared-iterations` | `shared-iterations` or `constant-vus`. |
| `--vus` | `1` | Virtual users. |
| `--iterations` | `1` | Total shared iterations. |
| `--duration` | `0s` | Constant-VU duration. |
| `--query-timeout` | `0s` | Per-statement deadline; zero disables it. |

Power/fixed-work run:

```bash
stroppy run tpcb/tx \
  --executor shared-iterations --vus 4 --iterations 100
```

Throughput run:

```bash
stroppy run tpcc/tx \
  --executor constant-vus --vus 32 --duration 5m
```

## Two-pass load and measure

Most database workloads run setup before their executor. Split loading from
measurement when load time must not affect throughput interpretation.

```bash
# Prepare data.
stroppy run tpcc/tx -d pg --scale-factor 50 --load-workers 16 \
  --no-steps workload

# Measure existing data.
stroppy run tpcc/tx -d pg --scale-factor 50 \
  --executor constant-vus --vus 64 --duration 1h \
  --steps workload
```

Step filters apply to both passes. Ensure both commands use the same database,
scale, SQL variant, and workload-specific range settings.

## `simple`

`simple` demonstrates the native workload lifecycle:

1. drop `stroppy_demo`;
2. create three-column table;
3. load 100 deterministic rows through a typed insert request;
4. validate row count and perform lookups;
5. drop table during teardown.

```bash
stroppy run simple -d pg
```

Steps: `drop_schema`, `create_schema`, `load_data`, `workload`.

The workload validates returned rows, so it is not a Noop-driver overhead test.
Use [`stroppy baseline`](./baseline) for Noop and wire ceilings.

## `tpcb/tx` and `tpcb/procs`

TPC-B models a banking transaction: update account, read balance, update teller
and branch, then append history.

```bash
stroppy run tpcb/tx -d pg --scale-factor 10 \
  --executor constant-vus --vus 32 --duration 5m

stroppy run tpcb/procs -d mysql --iterations 100
```

Typed workload flags:

| Flag | Default | Meaning |
|---|---|---|
| `--scale-factor` | `1` | Branch count; 10 tellers and 100,000 accounts per branch. |
| `--load-workers` | `1` | Workers used for each table load. |
| `--retry-attempts` | `3` | Maximum transaction attempts. |
| `--tx-isolation` | driver-derived | Isolation override. |
| `--sql-file` | dialect asset | SQL override. |

Default isolation: `read_committed` on PostgreSQL/MySQL, `none` on Picodata,
`serializable` on YDB.

Setup order:

```text
drop_schema
create_schema
create_procedures       # procs only
load_data
create_indexes
create_foreign_keys
analyze
workload
```

See [TPC-B](./tests/tpcb).

## `tpcc/tx` and `tpcc/procs`

TPC-C runs the standard 45/43/4/4/4 New-Order, Payment, Order-Status, Delivery,
and Stock-Level mix.

```bash
stroppy run tpcc/tx -d pg --scale-factor 10 \
  --executor constant-vus --vus 32 --duration 5m

stroppy run tpcc/procs -d mysql --pacing=true --iterations 100
```

Typed workload flags:

| Flag | Default | Meaning |
|---|---|---|
| `--scale-factor` | `1` | Warehouse count; legacy alias `WAREHOUSES`. |
| `--warehouse-start` | `1` | First warehouse ID for distributed loading. |
| `--load-items` | contextual | Load global item table; defaults true only at warehouse 1. |
| `--load-workers` | `1` | Workers per table load. |
| `--pacing` | `false` | Apply TPC-C keying and think times. |
| `--retry-attempts` | `3` | Maximum transaction attempts. |
| `--pg-unlogged` | `false` | Opt into PostgreSQL unlogged load. |
| `--tx-isolation` | driver-derived | Isolation override. |
| `--sql-file` | dialect asset | SQL override. |

Default isolation: `repeatable_read` on PostgreSQL/MySQL, `none` on Picodata,
`serializable` on YDB.

Setup order:

```text
drop_schema
create_schema
create_procedures       # procs only
set_unlogged            # opt-in PostgreSQL
load_data
create_indexes
set_logged              # when set_unlogged ran
create_foreign_keys
analyze
validate_population
workload
```

A population-validation failure is structural and exits nonzero. Both variants
emit per-transaction count, mix, throughput, and p50/p90/p95/p99 summaries.
Paced runs additionally report response-time/mix verdicts and steady-state
assessment.

See [TPC-C](./tests/tpcc).

## `tpch/tx`

TPC-H loads eight canonical dbgen tables and executes q1–q22 with pinned
parameters.

```bash
stroppy run tpch/tx -d pg --scale-factor 0.01
stroppy run tpch/tx -d pico --scale-factor 0.01
```

Typed workload flags:

| Flag | Default | Meaning |
|---|---|---|
| `--scale-factor` | `1` | Positive fractional row scale. |
| `--load-workers` | `0` | Load workers; zero resolves to one. |
| `--pg-unlogged` | `false` | Opt into PostgreSQL unlogged load. |
| `--ydb-store-mode` | `column` | `column` or `row`. |
| `--sql-file` | dialect asset | SQL override. |

Setup order:

```text
drop_schema
create_schema
set_unlogged            # opt-in PostgreSQL
load_data
create_indexes
set_logged              # when set_unlogged ran
analyze
validate_answers
workload
```

`o_totalprice` is computed during canonical generation; no post-load finalize
step exists. SF=1 answer comparison is PostgreSQL-only and diagnostic.

See [TPC-H](./tests/tpch).

## `tpcds`

TPC-DS loads all 24 canonical dsdgen tables. PostgreSQL, MySQL, and YDB execute
the baked query suite; Picodata supports loading only.

```bash
stroppy run tpcds -d pg --scale-factor 0.1
stroppy run tpcds -d ydb --scale-factor 0.1
stroppy run tpcds -d pico --scale-factor 0.1 --no-steps workload
```

Typed workload flags:

| Flag | Default | Meaning |
|---|---|---|
| `--scale-factor` | `1` | Positive fractional row scale. |
| `--load-workers` | `0` | Workers per table load. |
| `--pg-unlogged` | `false` | Opt into PostgreSQL unlogged load. |
| `--ydb-store-mode` | `column` | `column` or `row`. |
| `--streams` | `1` | Number of generated query streams. |
| `--query-stream` | unset | Explicit generated stream number. |
| `--query-seed` | `19620718` | Generated-stream seed. |
| `--schema-file` | dialect asset | Schema override. |
| `--sql-file` | dialect asset | Query override. |
| `--validate-force` | `false` | Compare SF=1 references outside SF=1. |

YDB accepts only the baked query set; generated streams are rejected. Answer
comparison is PostgreSQL/MySQL-only and diagnostic. Several static dimensions
remain large even at fractional scale.

Setup order:

```text
drop_schema
create_schema
set_unlogged            # opt-in PostgreSQL
load_data
create_indexes
set_logged              # when set_unlogged ran
analyze
validate_answers         # baked PG/MySQL path
workload
```

See [TPC-DS](./tests/tpcds).

## `execute_sql`

A `.sql` first positional or inline statement selects `execute_sql`:

```bash
stroppy run ./queries.sql -d pg
stroppy run "select 1" -d pg
```

Workload-specific flags:

| Flag | Default | Meaning |
|---|---|---|
| `--sql-file` | unset | SQL file path. |
| `--sql-body` | unset | Inline SQL body. |

Shared executor and query-timeout flags also apply. Named queries in a flat file
run in order. Nonfatal query errors are counted and the remaining query set
continues.

## Environment compatibility

Uppercase environment names and `-e` remain supported, but direct flags are
preferred:

```bash
stroppy run tpcc/tx -e warehouses=10 -e load_workers=8
```

Typed source precedence and config mapping are documented in
[Configuration Files](./config-file).
