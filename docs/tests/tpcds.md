---
sidebar_position: 3
title: TPC-DS
description: TPC-DS workload structure, load model, query suite, and parameters
---

# TPC-DS

TPC-DS is Stroppy's decision-support workload. It generates and loads the 24-table TPC-DS schema and runs the 103-query analytical suite against it.

It models the query load of a retail consolidator: store, web, and catalog sales and returns flowing into fact tables against dimension tables for items, customers, dates, and geography. The workload stresses the same surfaces as TPC-H &mdash; scans, multi-table joins, aggregation, sorting, subqueries &mdash; but at greater width, with snowflaked dimensions and a far larger, more varied query suite.

Use TPC-DS to evaluate:

- Bulk load throughput for wide, highly-normalized schemas.
- Star and snowflake join planning and execution.
- Aggregation, grouping, sorting, and top-N performance across large fact tables.
- Window-function and correlated-subquery plans (`rank`, `dense_rank`, `lag`, `lead`).
- Planner stability across a varied 100+ query suite.
- Engine correctness via answer-set validation and cross-database diffing.

## Script

TPC-DS has one script: `tpcds`. It supports PostgreSQL, MySQL, Picodata, and YDB.

```bash
stroppy run tpcds -d pg -D url=postgres://user:pass@host:5432/bench -e scale_factor=1
stroppy run tpcds -d mysql -D url=root:pass@tcp(host:3306)/bench -e scale_factor=0.1
stroppy run tpcds -d pico -e scale_factor=0.1
stroppy run tpcds -d ydb -D url=grpc://host:2136/database -e scale_factor=0.1
```

## Data Generation

Stroppy generates the dataset itself with a faithful Go port of the official `dsdgen`, validated byte-for-byte against the reference C generator across all 24 base tables. Generation is parallel and streaming &mdash; any table, including the multi-million-row sales and returns fact tables, can be produced in independent partitions with identical output. The workload creates the schema, generates and loads all 24 tables, builds single-table indexes, and runs `ANALYZE` before the query phase.

`SCALE_FACTOR` is a fractional row scale. Use `0.1` or `0.01` for smoke tests. Note that some static dimension tables (for example `customer_demographics`, ~1.9M rows) are fixed-size and do not shrink with the scale factor.

## Query Suite

The 103 queries run from per-dialect SQL files generated from the official query templates. Picodata omits 8 queries that sbroad cannot express &mdash; `query_36`, `query_44`, `query_47`, `query_49`, `query_57`, `query_67`, `query_70`, `query_86`, which need `rank`/`dense_rank`/`lag`/`lead` and correlated-subquery support &mdash; so a Picodata run executes 95 queries and logs the skip once at start.

By default the workload runs the baked canonical query set once (single power-test stream). For a throughput-style run, generate seeded permutations of the query set and drive several concurrent streams:

| ENV | Behavior |
|-----|----------|
| `STREAMS=N` (`N>1`) | Runs N concurrent VUs, each its own seeded permutation of the queries (throughput test). |
| `QUERY_STREAM=N` | Generates query stream N in-process with a fixed seed (single stream). |
| `QUERY_SEED` | RNG seed for generated streams. |

YDB runs the baked power test only. Setting `STREAMS>1` or a non-empty `QUERY_STREAM` with `-d ydb` is rejected, because the in-process stream generator cannot target YQL.

## Answer Validation

At `SCALE_FACTOR=1` on PostgreSQL and MySQL, the workload validates query results against the embedded official SF=1 answer set. Stroppy compares result multisets with numeric tolerance, so engine-specific null and tie ordering is not flagged as a mismatch. Set `VALIDATE_FORCE` to validate at any scale, and `ANSWER_DUMP` to dump normalized results to the log for cross-database diffing.

## Steps

| Step | Description |
|------|-------------|
| `drop_schema` | Drops existing tables (`CASCADE`), so a re-run against a leftover schema does not fail on dependents. |
| `create_schema` | Creates the 24 tables from the dialect schema (`schema.pg.sql`, `schema.mysql.sql`, `schema.pico.sql`, `schema.ydb.sql`). YDB column mode selects the column-store schema. |
| `set_unlogged` | PostgreSQL only, when `PG_UNLOGGED=true`. Flips tables to `UNLOGGED` before the bulk load. |
| `load_data` | Generates and loads all 24 tables via the native `dsdgen` path. |
| `create_indexes` | Builds single-table indexes after the load so bulk insert is not slowed by index maintenance. |
| `set_logged` | PostgreSQL only, when `PG_UNLOGGED=true`. Flips tables back to `LOGGED`. |
| `analyze` | PostgreSQL `ANALYZE` / MySQL `ANALYZE TABLE`. No-op on Picodata/YDB. |
| `workload` | Executes the query suite once with pinned parameters and logs per-query duration. Console-silent per iteration. Replaced by `validate_answers` when validating or dumping. |
| `validate_answers` | Runs the query suite, captures results, and compares to the SF=1 answer set (PostgreSQL/MySQL at `SCALE_FACTOR=1`, or when forced). Emits `__TPCDS_DUMP__` lines when `ANSWER_DUMP` is set. |

Examples:

```bash
stroppy run tpcds -d pg --steps drop_schema,create_schema,load_data
stroppy run tpcds -d pg --steps workload
```

## SQL Files

When `SQL_FILE` is not set, the script chooses a query file from the active driver type:

| Driver type | Query file | Schema file |
|-------------|-----------|-------------|
| `postgres` | `tpcds/pg.sql` | `schema.pg.sql` |
| `mysql` | `tpcds/mysql.sql` | `schema.mysql.sql` |
| `picodata` | `tpcds/pico.sql` | `schema.pico.sql` |
| `ydb` | `tpcds/ydb.sql` | `schema.ydb.sql` |

Pass an explicit SQL file with `SQL_FILE` to force a variant:

```bash
stroppy run tpcds -d pg -e sql_file=./tpcds/pg.sql
```

## Parameters

Workload parameters are passed as environment variables with `-e key=VALUE`. Keys are case-insensitive in the CLI.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `SCALE_FACTOR` | `1` | TPC-DS scale factor (fractional). |
| `STREAMS` | `1` | Concurrent throughput query streams. `1` = single power-test stream. |
| `QUERY_STREAM` | empty | Generate query stream N in-process (empty = baked canonical set). |
| `QUERY_SEED` | `19620718` | RNG seed for generated query streams. |
| `POOL_SIZE` | `50` | Sets both `minConns` and `maxConns` for the primary driver pool. |
| `LOAD_WORKERS` | `0` | Parallel load workers per table. `0` lets the framework choose. |
| `YDB_STORE_MODE` | `column` | YDB storage: `column` (default, OLAP column store) or `row`. |
| `PG_UNLOGGED` | `true` | PostgreSQL fast bulk-load via `UNLOGGED` tables, flipped back to `LOGGED` after load. |
| `SQL_FILE` | auto | Query SQL file. Defaults to a dialect file based on `driverType`. |
| `VALIDATE_FORCE` | empty | Force answer validation at any scale. |
| `ANSWER_DUMP` | empty | Dump normalized query results to the log for cross-database diffing. |

TPC-DS queries are read-only and issued outside an explicit transaction; there is no `TX_ISOLATION` knob.

## Metrics

TPC-DS does not define custom k6 Trend or Counter metrics per query. Query timings flow through the common driver metrics during the query phase:

| Metric | Type | Description |
|--------|------|-------------|
| `run_query_count` | Counter | SQL statements executed by the driver. |
| `run_query_duration` | Trend | SQL execution latency samples, tagged by the active step. |
| `run_query_error_rate` | Rate | Query execution failure rate. |
| `insert_duration` | Trend | Bulk-load duration samples. Useful for load throughput analysis. |
| `insert_error_rate` | Rate | Insert failures during data loading. |

For PostgreSQL/MySQL at `SCALE_FACTOR=1`, `validate_answers` prints a validation summary against `answers_sf1.json`, including `OK`, `DIFF`, `SKIP`, and `ERROR` rows per query.

## Thresholds

TPC-DS does not define k6 thresholds by default. The run is not auto-failed by a slow query threshold; correctness is gated by answer-set validation instead.
