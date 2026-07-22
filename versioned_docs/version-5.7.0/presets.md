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
stroppy run tpcds
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
| `tpcds` | TPC-DS analytical schema load and 103-query execution. | `tpcds.ts` | `pg.sql`, `mysql.sql`, `pico.sql`, `ydb.sql` plus per-dialect `schema.*.sql` |
| `execute_sql` | Generic SQL file or inline SQL runner. | `execute_sql.ts` | user-provided |

## Run Knobs: VUs, Duration, Iterations

Every TPC workload builds its k6 scenario from the same environment knobs through `declareScenario()` in `helpers.ts`:

| ENV | Default | Description |
|-----|---------|-------------|
| `VUS` | `1` | Workload concurrency (virtual users). |
| `DURATION` | unset | Throughput run length (Go duration, e.g. `1h`). When set, selects the `constant-vus` executor and the result is transactions-per-second. |
| `ITER` | `1` | Power-test iteration count (`shared-iterations`), used when `DURATION` is unset. |
| `MAX_DURATION` | `24h` | Wall-clock cap for the power run; lifts k6's 10-minute per-iteration limit. |

Environment keys are case-insensitive on the CLI &mdash; `-e vus=10`, `-e VUS=10`, and `-e Vus=10` are the same. Examples here use lowercase for brevity; the tables above show the canonical uppercase names.

Two run shapes:

- **Power run** &mdash; `DURATION` unset. Runs `VUS` &times; `ITER` total iterations as fast as possible; the result is elapsed time. The default (`VUS=1`, `ITER=1`) is a single pass.
- **Throughput run** &mdash; `DURATION` set. Holds `VUS` concurrent users for the duration; the result is sustained throughput.

Set these with `-e`, not the k6 `--vus`/`--duration` shortflags. The workloads define `options.scenarios`, and passing k6 shortflags after `--` overwrites that block entirely (including `maxDuration`). The shortflags still work for backwards compatibility, but the env knobs are the supported way to parameterize a run.

### Two-run flow: load, then measure

Every workload loads data inside the measured `default()` function (gated to run once per process), not in k6's `setup()`. A single run loads and then measures in one pass. For an uncontaminated throughput number, split it into two runs against the same database:

```bash
# 1. Load only — run every step except the workload, single iteration
stroppy run tpcc/tx -d pg -D url=postgres://user:pass@host:5432/bench \
  -e warehouses=50 -e load_workers=16 --no-steps workload

# 2. Measure only — run just the workload against the loaded data
stroppy run tpcc/tx -d pg -D url=postgres://user:pass@host:5432/bench \
  -e warehouses=50 -e vus=64 -e duration=1h --steps workload
```

The first run leaves the schema and data in place; the second skips `drop_schema`/`load_data` and spends the whole duration on the transaction loop.

## Common lifecycle

All four TPC workloads (B, C, H, DS) share one lifecycle. Each setup step logs how long it took, e.g. `End of 'create_schema' step (took 1.23s)`; the per-iteration `workload` step is silent on the console but still emits metrics.

| Step | When it runs | What it does |
|------|--------------|--------------|
| `drop_schema` | always | Drops existing objects; `CASCADE` so dependents go too. |
| `create_schema` | always | Creates tables from the dialect DDL (and procedures, for `procs` variants). |
| `set_unlogged` | PostgreSQL, `PG_UNLOGGED=true` | Flips tables to `UNLOGGED` before the bulk load for a WAL-free load. |
| `load_data` | always | Bulk-loads the initial population through InsertSpec (or the workload's native generator). |
| `finalize_totals` | TPC-H only | Recomputes `orders.o_totalprice` from lineitems. No-op with the `gotpc` generator, which finalizes at generation time. |
| `create_indexes` | always | Builds secondary indexes after the load, so bulk insert is not slowed by index maintenance. |
| `set_logged` | PostgreSQL, `PG_UNLOGGED=true` | Flips tables back to `LOGGED`. |
| `create_foreign_keys` | TPC-B, TPC-C | Adds foreign keys after `set_logged`, once every table is `LOGGED`. No-op on Picodata/YDB. |
| `analyze` | always | PostgreSQL `ANALYZE` / MySQL `ANALYZE TABLE` so the planner has fresh statistics. No-op on Picodata/YDB. |
| `validate_population` | TPC-C (`tx`) | Verifies row counts and TPC-C consistency rules; aborts the run (exit 108) on mismatch. |
| `validate_answers` | TPC-H, TPC-DS | Compares query results to the embedded SF=1 answer set (PostgreSQL/MySQL at `SCALE_FACTOR=1`). |
| `workload` | always | The measured phase: the transaction loop (B/C) or the query suite (H/DS). |

`PG_UNLOGGED=false` skips `set_unlogged`/`set_logged` and creates foreign keys against normally-logged tables. If you pass an explicit `--steps` allowlist on PostgreSQL, include `create_foreign_keys` or the references will be missing.

## simple

`simple` is a first-run smoke test and a small example of the InsertSpec API.

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

Steps: `drop_schema`, `create_schema`, `load_data`, `workload`.

The workload uses a single VU and one iteration. Use `tpcb/tx` or `tpcc/tx` when you want a duration/VU throughput run.

## tpcb

TPC-B models a simple banking transaction: update an account balance, update teller and branch totals, and insert a history row. It is the workload behind `pgbench` and is useful for transactional throughput testing.

```bash
stroppy run tpcb/tx -d pg
stroppy run tpcb/tx -d pg -e scale_factor=10 -e vus=32 -e duration=5m
stroppy run tpcb/procs -d mysql
```

Use `tpcb/tx` for portable client-side transactions across PostgreSQL, MySQL, Picodata, and YDB. Use `tpcb/procs` for PostgreSQL/MySQL stored-procedure mode.

`SCALE_FACTOR` is an integer branch count (&ge;1). Tellers = 10 &times; scale; accounts = 100,000 &times; scale.

| ENV | Default | Description |
|-----|---------|-------------|
| `SCALE_FACTOR`, `BRANCHES` | `1` | Number of branches. Integer. |
| `POOL_SIZE` | `50` | Primary driver pool size (`minConns` = `maxConns`). |
| `LOAD_WORKERS` | `0` | Parallel InsertSpec workers during load. `0` lets the framework choose. |
| `PG_UNLOGGED` | `true` | PostgreSQL fast bulk-load via `UNLOGGED` tables. |
| `SQL_FILE` | auto | SQL file path. Defaults to a dialect file based on `driverType`. |
| `TX_ISOLATION` | auto | Overrides transaction isolation. Defaults: `read_committed` (postgres/mysql), `none` (picodata), `serializable` (ydb). |

Steps: `drop_schema`, `create_schema`, (`set_unlogged`), `load_data`, `create_indexes`, (`set_logged`), `create_foreign_keys`, `analyze`, `workload`. `tpcb/procs` adds `create_procedures` after `create_schema`.

## tpcc

TPC-C loads a warehouse schema and runs the standard 45/43/4/4/4 mix of New-Order, Payment, Order-Status, Delivery, and Stock-Level transactions.

```bash
stroppy run tpcc/tx -d pg -e warehouses=50 -e vus=64 -e duration=1h
stroppy run tpcc/procs -d mysql
```

Use `tpcc/tx` for portable client-side transactions across PostgreSQL, MySQL, Picodata, and YDB. Use `tpcc/procs` for PostgreSQL/MySQL stored procedures.

`SCALE_FACTOR` (alias `WAREHOUSES`) is an integer warehouse count (&ge;1).

| ENV | Default | Description |
|-----|---------|-------------|
| `SCALE_FACTOR`, `WAREHOUSES` | `1` | Number of warehouses. Integer. |
| `POOL_SIZE` | `100` | Primary driver pool size. |
| `LOAD_WORKERS` | `0` | Parallel InsertSpec workers during load. |
| `RETRY_ATTEMPTS` | `3` | Attempts for retryable serialization failures. `1` disables retries. |
| `PACING` | `false` | Enable TPC-C keying and think-time delays. |
| `PG_UNLOGGED` | `true` | PostgreSQL fast bulk-load via `UNLOGGED` tables. |
| `SQL_FILE` | auto | SQL file path selected by driver type. |
| `TX_ISOLATION` | auto | Override transaction isolation. Defaults: `repeatable_read` (postgres/mysql), `none` (picodata), `serializable` (ydb). |

Steps: `drop_schema`, `create_schema`, (`set_unlogged`), `load_data`, `create_indexes`, (`set_logged`), `create_foreign_keys`, `analyze`, `validate_population`, `workload`. `tpcc/procs` adds `create_procedures`; it has no `validate_population` or `create_indexes` step.

A failed `validate_population` check aborts the run with exit code 108 instead of reporting success. Skip it with `--no-steps validate_population` to force a zero exit.

TPC-C defines k6 thresholds on the per-transaction latency trends. The post-run summary reports the observed transaction mix, compliance ratios, retry counts, and Stroppy driver/transaction metrics.

See [TPC-C](tests/tpcc) for the full test article.

## tpch

TPC-H loads the eight-table analytical schema and runs Q1 through Q22.

```bash
stroppy run tpch/tx -d pg -e scale_factor=0.01
stroppy run tpch/tx -d mysql -e scale_factor=0.01
stroppy run tpch/tx -d pico -e scale_factor=0.01
stroppy run tpch/tx -d pg -e scale_factor=1
```

`SCALE_FACTOR` is a fractional row scale (`0.01` for smoke tests). PostgreSQL and MySQL at `SCALE_FACTOR=1` validate query output against the embedded SF=1 reference answers. The 22 queries run on PostgreSQL, MySQL, Picodata, and YDB; the Picodata SQL is a port that works around sbroad's SQL limits.

| ENV | Default | Description |
|-----|---------|-------------|
| `SCALE_FACTOR` | `1` | TPC-H scale factor (fractional). `0.01` for smoke tests. |
| `TPCH_GENERATOR` | `gotpc` | Data generator: `gotpc` (faithful `dbgen` port, default) or `relgen` (relational InsertSpec). |
| `POOL_SIZE` | `50` | Primary driver pool size. |
| `LOAD_WORKERS` | `0` | Parallel InsertSpec workers during load (`relgen` only). |
| `YDB_STORE_MODE` | `column` | YDB storage: `column` (column store) or `row`. |
| `PG_UNLOGGED` | `true` | PostgreSQL fast bulk-load via `UNLOGGED` tables. |
| `SQL_FILE` | auto | SQL file path selected by driver type. |
| `TX_ISOLATION` | auto | Kept for symmetry; TPC-H queries are read-only. |

Steps: `drop_schema`, `create_schema`, (`set_unlogged`), `load_data`, `finalize_totals`, `create_indexes`, (`set_logged`), `analyze`, `validate_answers`, `workload`. The query pass is the `workload` step.

See [TPC-H](tests/tpch) for the full test article.

## tpcds

TPC-DS loads the 24-table analytical schema and runs the 103-query decision-support suite. Stroppy generates the dataset itself with a faithful Go port of the official `dsdgen`, validates byte-for-byte against the reference C generator, then builds single-table indexes and runs `ANALYZE` before the query phase.

```bash
stroppy run tpcds -d pg -e scale_factor=1
stroppy run tpcds -d mysql -e scale_factor=0.1
stroppy run tpcds -d pico -e scale_factor=0.1
stroppy run tpcds -d ydb -e scale_factor=0.1
```

`SCALE_FACTOR` is a fractional row scale (`0.1` or `0.01` for smoke tests). Note that some static dimension tables (`customer_demographics`, ~1.9M rows) are fixed-size and do not shrink with the scale factor.

The 103 queries run on PostgreSQL, MySQL, Picodata, and YDB from per-dialect SQL files. Picodata omits 8 queries that sbroad cannot express (`query_36`, `query_44`, `query_47`, `query_49`, `query_57`, `query_67`, `query_70`, `query_86` &mdash; they need `rank`/`dense_rank`/`lag`/`lead`), so a Picodata run executes 95 queries. Answer-set validation is PostgreSQL/MySQL-only at `SCALE_FACTOR=1`.

| ENV | Default | Description |
|-----|---------|-------------|
| `SCALE_FACTOR` | `1` | TPC-DS scale factor (fractional). |
| `STREAMS` | `1` | Concurrent throughput query streams. `>1` runs a seeded permutation per stream (throughput test). `1` is the single power-test stream. |
| `QUERY_STREAM` | empty | Generate query stream N in-process (empty = baked canonical set). |
| `QUERY_SEED` | `19620718` | RNG seed for generated query streams. |
| `POOL_SIZE` | `50` | Primary driver pool size. |
| `LOAD_WORKERS` | `0` | Parallel load workers per table. |
| `YDB_STORE_MODE` | `column` | YDB storage: `column` (default, OLAP) or `row`. |
| `PG_UNLOGGED` | `true` | PostgreSQL fast bulk-load via `UNLOGGED` tables. |
| `SQL_FILE` | auto | SQL file path selected by driver type. |
| `VALIDATE_FORCE` | empty | Force answer validation at any scale. |
| `ANSWER_DUMP` | empty | Dump normalized results to the log for cross-database diffing. |

Steps: `drop_schema`, `create_schema`, (`set_unlogged`), `load_data`, `create_indexes`, (`set_logged`), `analyze`, then either `workload` (the query suite) or `validate_answers` (SF=1 answer comparison). The query pass is the `workload` step.

YDB runs the baked power test only: setting `STREAMS>1` or a non-empty `QUERY_STREAM` with `-d ydb` is rejected, because the in-process stream generator cannot target YQL.

See [TPC-DS](tests/tpcds) for the full test article.

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

Current multi-dialect built-ins select SQL inside the script by `driverType`. The runner still supports explicit SQL resolution:

1. A second positional argument is resolved as a SQL file and takes priority.
2. `SQL_FILE` can be set explicitly through the environment or `-e`.
3. If neither is set, the script chooses `pg.sql`, `mysql.sql`, `pico.sql`, or `ydb.sql` from the active driver type.

Examples:

```bash
stroppy run tpcc/tx tpcc/pico -d pico
stroppy run tpch/tx tpch/pg -d pg
stroppy run tpcc/tx -e sql_file=./custom.sql
```

## Workload Variants

Many presets ship with multiple script variants:

| Variant | File | Description |
|---------|------|-------------|
| `tx` | `tx.ts` | Client-side transaction variant. Portable when dialect files exist for the target. |
| `procs` | `procs.ts` | Stored-procedure variant. Used by TPC-B/TPC-C on PostgreSQL and MySQL. |
