---
sidebar_position: 7
title: Built-in Workloads
description: TPC-B, TPC-C, TPC-H, TPC-DS, and utility workloads with parameters and variants
---

# Built-in Workloads

Stroppy ships with embedded workload scripts and SQL files. You can run them without generating a workspace:

```bash
stroppy run simple
stroppy run tpcb/tx
stroppy run tpcb/procs
stroppy run tpcc/tx
stroppy run tpcc/procs
stroppy run tpch/tx
stroppy run tpcds tpcds-scale-100
stroppy run execute_sql
```

Each workload is a TypeScript script bundled with any SQL files it needs. Stroppy resolves them through the standard search path; see `stroppy help resolution` for details.

## Available Presets

| Preset | Description | Script variants | SQL variants |
|--------|-------------|-----------------|--------------|
| `simple` | Minimal smoke workload that creates, loads, verifies, and drops a small demo table. | `simple.ts` | none |
| `tpcb` | TPC-B style banking transaction. | `tx.ts`, `procs.ts` | `pg.sql`, `mysql.sql`, `pico.sql`, `ydb.sql` for `tx`; `pg.sql`, `mysql.sql` for `procs` |
| `tpcc` | TPC-C OLTP workload with five weighted transaction types. | `tx.ts`, `procs.ts` | `pg.sql`, `mysql.sql`, `pico.sql`, `ydb.sql`; procs supports PostgreSQL/MySQL |
| `tpch` | TPC-H analytical schema load and Q1-Q22 execution. | `tx.ts` | `pg.sql`, `mysql.sql`, `pico.sql`, `ydb.sql` |
| `tpcds` | TPC-DS analytical query runner. | `tpcds.ts` | scale-factor SQL files |
| `execute_sql` | Generic SQL file or inline SQL runner. | `execute_sql.ts` | user-provided |

## simple

`simple` is a first-run smoke test and a small example of the current InsertSpec API.

```bash
stroppy run simple
stroppy run simple -d noop
stroppy run simple -d pg -D url=postgres://user:pass@host:5432/postgres
```

What it does:

1. Drops `stroppy_demo` if it exists.
2. Creates `stroppy_demo (id INT PRIMARY KEY, label TEXT, value INT)`.
3. Loads 100 deterministic rows with `Rel.table(...)` and `driver.insertSpec(...)`.
4. Validates the row count.
5. Performs three row lookups with `DrawRT`.
6. Drops the table in teardown.

Steps:

| Step | What it does |
|------|-------------|
| `drop_schema` | Drops `stroppy_demo`. |
| `create_schema` | Creates the demo table. |
| `load_data` | Loads 100 rows with InsertSpec. |
| `workload` | Validates count and performs lookups. |

The workload uses a fixed `shared-iterations` scenario with one VU and one iteration. Use `tpcb/tx` or `tpcc/tx` when you want a duration/VU throughput run.

## tpcb

TPC-B models a simple banking transaction: update an account balance, update teller and branch totals, and insert a history row. It is the workload behind `pgbench` and is useful for transactional throughput testing.

### Running

```bash
stroppy run tpcb/tx -d pg
stroppy run tpcb/tx -d pg -e scale_factor=10 -- --duration 5m --vus 32
stroppy run tpcb/procs -d mysql
```

Use `tpcb/tx` for portable client-side transactions across PostgreSQL, MySQL, Picodata, and YDB. Use `tpcb/procs` for PostgreSQL/MySQL stored procedure mode.

### Parameters

| ENV variable | Default | Variant | Description |
|--------------|---------|---------|-------------|
| `SCALE_FACTOR`, `BRANCHES` | `1` | both | Number of branches. Tellers = 10 x scale; accounts = 100,000 x scale. |
| `POOL_SIZE` | `50` | both | Primary driver pool size. |
| `LOAD_WORKERS` | `0` | `tpcb/tx` | Parallel InsertSpec workers during load. `0` lets the framework choose. |
| `SQL_FILE` | `<auto>` | both | SQL file path. Defaults to a dialect file based on `driverType`. |
| `TX_ISOLATION` | `<auto>` | `tpcb/tx` | Overrides transaction isolation. Defaults are driver-specific. |

### Steps

| Step | Variant | What it does |
|------|---------|-------------|
| `drop_schema` | both | Drops existing TPC-B objects. |
| `create_schema` | both | Creates `pgbench_branches`, `pgbench_tellers`, `pgbench_accounts`, and `pgbench_history`. |
| `create_procedures` | `tpcb/procs` | Creates PostgreSQL/MySQL stored procedures. |
| `load_data` | both | Loads branches, tellers, and accounts with InsertSpec. |
| `workload` | both | Runs the transaction loop. |

```bash
stroppy run tpcb/tx --steps drop_schema,create_schema,load_data
stroppy run tpcb/tx --steps workload
stroppy run tpcb/tx --no-steps drop_schema
```

### SQL variants

`tpcb/tx` selects SQL by driver type:

| Driver type | SQL file |
|-------------|----------|
| `postgres` | `tpcb/pg.sql` |
| `mysql` | `tpcb/mysql.sql` |
| `picodata` | `tpcb/pico.sql` |
| `ydb` | `tpcb/ydb.sql` |

`tpcb/procs` supports PostgreSQL and MySQL only.

## tpcc

TPC-C loads a warehouse schema and runs the standard 45/43/4/4/4 mix of New-Order, Payment, Order-Status, Delivery, and Stock-Level transactions.

```bash
stroppy run tpcc/tx -d pg
stroppy run tpcc/tx -d pg -e warehouses=10 -- --vus 32 --duration 30m
stroppy run tpcc/procs -d mysql
```

Use `tpcc/tx` for portable client-side transactions across PostgreSQL, MySQL, Picodata, and YDB. Use `tpcc/procs` for PostgreSQL/MySQL stored procedures.

Common parameters:

| ENV variable | Default | Variant | Description |
|--------------|---------|---------|-------------|
| `POOL_SIZE` | `100` | both | Primary driver pool size. |
| `SCALE_FACTOR`, `WAREHOUSES` | `1` | both | Number of warehouses. |
| `LOAD_WORKERS` | `0` | `tpcc/tx` | Parallel InsertSpec workers during load. |
| `RETRY_ATTEMPTS` | `3` | both | Attempts for retryable serialization failures. |
| `PACING` | `false` | `tpcc/tx` | Enable TPC-C keying and think-time delays. |
| `SQL_FILE` | `<auto>` | both | SQL file path selected by driver type. |
| `TX_ISOLATION` | `<auto>` | both | Override transaction isolation. |

Core steps are `drop_schema`, `create_schema`, `load_data`, and `workload`. `tpcc/procs` adds `create_procedures`; `tpcc/tx` adds `create_indexes` and `validate_population` where dialect files define them.

TPC-C defines k6 thresholds for the per-transaction latency trends. The post-run summary also reports observed transaction mix, compliance ratios, retry counts, and Stroppy driver/transaction metrics.

See [TPC-C](./tests/tpcc) for the full test article.

## tpch

TPC-H loads the eight-table analytical schema and runs Q1 through Q22 once with pinned query parameters.

```bash
stroppy run tpch/tx -d pg -e scale_factor=0.01
stroppy run tpch/tx -d mysql -e scale_factor=0.01
stroppy run tpch/tx -d pg -e scale_factor=1
```

Use `SCALE_FACTOR=0.01` for smoke tests. PostgreSQL at `SCALE_FACTOR=1` validates query output against embedded SF=1 reference answers.

Parameters:

| ENV variable | Default | Description |
|--------------|---------|-------------|
| `POOL_SIZE` | `50` | Primary driver pool size. |
| `SCALE_FACTOR` | `1` | TPC-H scale factor; `0.01` is supported for smoke tests. |
| `LOAD_WORKERS` | `0` | Parallel InsertSpec workers during load. |
| `SQL_FILE` | `<auto>` | SQL file path selected by driver type. |
| `TX_ISOLATION` | `<auto>` | Override transaction isolation. |

Steps are `drop_schema`, `create_schema`, `load_data`, `set_logged`, `create_indexes`, `finalize_totals`, `queries`, `validate_answers`, and `workload`.

See [TPC-H](./tests/tpch) for the full test article.

## tpcds

The TPC-DS workload runs analytical read-only queries from a supplied scale-factor SQL file. It does not create tables or load data; it assumes you have already loaded a TPC-DS dataset at the selected scale.

```bash
stroppy run tpcds tpcds-scale-1
stroppy run tpcds tpcds-scale-100
stroppy run tpcds tpcds-scale-10000
```

The second argument selects the SQL file. There is no default because the correct query set depends on dataset size.

Available embedded files:

| Scale factor | File | Usage |
|--------------|------|-------|
| 1 | `tpcds-scale-1.sql` | `stroppy run tpcds tpcds-scale-1` |
| 10 | `tpcds-scale-10.sql` | `stroppy run tpcds tpcds-scale-10` |
| 100 | `tpcds-scale-100.sql` | `stroppy run tpcds tpcds-scale-100` |
| 300 | `tpcds-scale-300.sql` | `stroppy run tpcds tpcds-scale-300` |
| 1,000 | `tpcds-scale-1000.sql` | `stroppy run tpcds tpcds-scale-1000` |
| 3,000 | `tpcds-scale-3000.sql` | `stroppy run tpcds tpcds-scale-3000` |
| 10,000 | `tpcds-scale-10000.sql` | `stroppy run tpcds tpcds-scale-10000` |
| 30,000 | `tpcds-scale-30000.sql` | `stroppy run tpcds tpcds-scale-30000` |
| 50,000 | `tpcds-scale-50000.sql` | `stroppy run tpcds tpcds-scale-50000` |
| 100,000 | `tpcds-scale-100000.sql` | `stroppy run tpcds tpcds-scale-100000` |

The script runs with one VU and one iteration: a single pass through all queries.

## execute_sql

`execute_sql` runs every query from a SQL file or inline SQL string. It powers the `.sql` and inline SQL input modes.

```bash
# SQL file mode
stroppy run queries.sql

# Inline SQL mode
stroppy run "select count(*) from orders"
stroppy run "create table foo (id int)"
```

`SQL_FILE` is set automatically when you pass a SQL file. The script parses flat SQL with `parse_sql` and executes each query with `driver.exec()`.

## SQL File Selection

Current multi-dialect built-ins generally select SQL inside the script by `driverType`. The runner still supports explicit SQL resolution:

1. A second positional argument is resolved as a SQL file and takes priority.
2. `SQL_FILE` can be set explicitly through the environment or `-e`.
3. If neither is set, the script usually chooses `pg.sql`, `mysql.sql`, `pico.sql`, or `ydb.sql` from the active driver type.

Examples:

```bash
stroppy run tpcc/tx tpcc/pico -d pico
stroppy run tpch/tx tpch/pg -d pg
stroppy run tpcds tpcds-scale-1000
stroppy run tpcc/tx -e sql_file=./custom.sql
```

## Workload Variants

Many presets ship with multiple script variants:

| Variant | File | Description |
|---------|------|-------------|
| `tx` | `tx.ts` | Client-side transaction variant. Portable when dialect files exist for the target. |
| `procs` | `procs.ts` | Stored-procedure variant. Used by TPC-B/TPC-C on PostgreSQL and MySQL. |
| scale SQL | `*.sql` | Analytical SQL variants selected as the second positional argument, such as TPC-DS scale files. |
