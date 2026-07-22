---
sidebar_position: 2
title: TPC-H
description: TPC-H workload structure, load model, query suite, and parameters
---

# TPC-H

TPC-H is Stroppy's analytical workload. It bulk-loads the eight TPC-H tables and runs the 22 decision-support queries.

It simulates a decision-support system that scans orders, line items, customers, suppliers, parts, and geography data to answer business questions. The workload is read-heavy after loading and stresses query planning, joins, aggregation, sorting, filtering, and date/range predicates.

Use TPC-H to evaluate:

- Bulk load throughput for large relational datasets.
- Scan bandwidth and predicate filtering efficiency.
- Join planning and join execution across fact and dimension tables.
- Aggregation, grouping, sorting, and top-N performance.
- Index usefulness for analytical SQL.
- Memory pressure, temporary files, and spill behavior on large queries.
- Planner stability across a varied 22-query suite.

## Script

TPC-H has one script: `tpch/tx`. It supports PostgreSQL, MySQL, Picodata, and YDB through dialect-specific SQL files.

```bash
stroppy run tpch/tx -d pg -D url=postgres://user:pass@host:5432/bench -e scale_factor=0.01
stroppy run tpch/tx -d mysql -D url=root:pass@tcp(host:3306)/bench -e scale_factor=0.01
stroppy run tpch/tx -d pico -e scale_factor=0.01
stroppy run tpch/tx -d pg -e scale_factor=1
```

Use `SCALE_FACTOR=0.01` for smoke tests. Use `SCALE_FACTOR=1` when you want PostgreSQL or MySQL answer validation against the embedded SF=1 reference answers. The 22 queries run on all four drivers; the Picodata SQL is a port that rewrites sbroad-incompatible constructs (explicit `JOIN ON`, bare date strings, decorrelated subqueries) and is answer-checked against PostgreSQL.

## Load Type

TPC-H is a bulk-load plus query-suite workload, not a sustained per-iteration transaction loop. The load and the query pass both run inside the measured `default()` function (the load is gated to run once per process):

1. Creates schema.
2. Loads all tables.
3. Finalizes derived totals.
4. Creates indexes and runs `ANALYZE`.
5. Executes Q1 through Q22 once.
6. Validates answers for PostgreSQL/MySQL at `SCALE_FACTOR=1`.

This makes TPC-H a single-pass analytical benchmark rather than a concurrency benchmark. Increase `SCALE_FACTOR` to increase data volume, and use database-side monitoring to inspect CPU, I/O, memory, temp-space, and parallel worker behavior during the query phase.

## Data Model

For scale factor `SF` (a fractional row scale), Stroppy loads:

| Table | Rows |
|-------|------|
| `region` | `5` |
| `nation` | `25` |
| `part` | `floor(200,000 * SF)`, minimum 1 |
| `supplier` | `floor(10,000 * SF)`, minimum 1 |
| `partsupp` | `4 * part` |
| `customer` | `floor(150,000 * SF)`, minimum 1 |
| `orders` | `floor(1,500,000 * SF)`, minimum 1 |
| `lineitem` | Uniform 1..7 rows per order, about `4 * orders` |

`orders.o_orderkey` follows the TPC-H sparse-key scheme. With the default `gotpc` generator, `orders.o_totalprice` is finalized at generation time, so no post-load fix-up is needed. With the legacy `relgen` generator it is a placeholder until the `finalize_totals` step recomputes it.

## Generator

`TPCH_GENERATOR` selects the data generator:

| Generator | Description |
|-----------|-------------|
| `gotpc` (default) | Faithful Go port of the official `dbgen`. Produces correct query answers (validated against the official SF=1 answer set) and finalizes `o_totalprice` at generation time. Faster, especially for `lineitem`. |
| `relgen` | Relational InsertSpec generator (the previous default). `o_totalprice` is recomputed by the `finalize_totals` step after load. |

## Steps

| Step | Description |
|------|-------------|
| `drop_schema` | Removes existing TPC-H tables so the next run starts from a clean dataset. |
| `create_schema` | Executes the dialect DDL and creates `region`, `nation`, `part`, `supplier`, `partsupp`, `customer`, `orders`, and `lineitem`. PostgreSQL creates these as `UNLOGGED` first when `PG_UNLOGGED=true`. |
| `set_unlogged` | PostgreSQL only, when `PG_UNLOGGED=true`. Flips tables to `UNLOGGED` before the bulk load. |
| `load_data` | Bulk-loads all eight tables. With `gotpc` via the native generator path; with `relgen` through InsertSpec. |
| `finalize_totals` | Recomputes `orders.o_totalprice` after `lineitem` exists using the TPC-H formula: sum of `l_extendedprice * (1 + l_tax) * (1 - l_discount)` per order. No-op with `gotpc`, which finalizes at generation time. Picodata keeps this as a no-op because its SQL layer does not support the required correlated update shape. |
| `create_indexes` | Creates query-support indexes from the selected SQL file, including join keys and date/order keys used by the 22 query templates. |
| `set_logged` | PostgreSQL only, when `PG_UNLOGGED=true`. Flips tables back to `LOGGED`. |
| `analyze` | PostgreSQL `ANALYZE` / MySQL `ANALYZE TABLE`. No-op on Picodata/YDB. |
| `validate_answers` | Runs correctness comparison for PostgreSQL/MySQL at `SCALE_FACTOR=1`, where embedded reference answers are available. Other scale factors and drivers log a skip instead of comparing incompatible result sets. |
| `workload` | Executes Q1 through Q22 once with pinned TPC-H parameters and logs per-query duration. Continues through the suite even if an individual query reports an error. |

Examples:

```bash
stroppy run tpch/tx --steps drop_schema,create_schema,load_data
stroppy run tpch/tx --no-steps drop_schema
```

## SQL Files

When `SQL_FILE` is not set, `tpch/tx` chooses a dialect file from the active driver type:

| Driver type | SQL file |
|-------------|----------|
| `postgres` | `tpch/pg.sql` |
| `mysql` | `tpch/mysql.sql` |
| `picodata` | `tpch/pico.sql` |
| `ydb` | `tpch/ydb.sql` |

Pass an explicit SQL file to force a variant:

```bash
stroppy run tpch/tx tpch/pg -d pg
stroppy run tpch/tx tpch/ydb -d ydb
```

## Parameters

Workload parameters are passed as environment variables with `-e key=VALUE`. Keys are case-insensitive in the CLI.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `SCALE_FACTOR` | `1` | TPC-H scale factor (fractional). Must be positive. `0.01` is supported for smoke tests. |
| `TPCH_GENERATOR` | `gotpc` | Data generator: `gotpc` or `relgen`. |
| `POOL_SIZE` | `50` | Sets both `minConns` and `maxConns` for the primary driver pool. |
| `LOAD_WORKERS` | `0` | Parallel InsertSpec workers during `load_data` (`relgen` only). `0` lets the framework choose. |
| `YDB_STORE_MODE` | `column` | YDB storage mode: `column` (column store, default) or `row`. |
| `PG_UNLOGGED` | `true` | PostgreSQL fast bulk-load via `UNLOGGED` tables, flipped back to `LOGGED` after load. |
| `SQL_FILE` | auto | SQL file path. Defaults to a dialect file based on `driverType`. |
| `TX_ISOLATION` | auto | Kept for symmetry; TPC-H queries are read-only. |

Common runner controls also apply: `--steps`, `--no-steps`, and `-d`/`-D` driver options.

## Metrics

TPC-H does not define custom k6 Trend or Counter metrics per query. Query timings are printed to stdout as each query finishes:

```text
[tpch] q1: ok in 1234ms
```

For PostgreSQL/MySQL at `SCALE_FACTOR=1`, `validate_answers` prints a validation summary against `answers_sf1.json`, including `OK`, `DIFF`, `SKIP`, and `ERROR` rows per query.

Stroppy still emits common driver metrics during load and query execution:

| Metric | Type | Description |
|--------|------|-------------|
| `insert_duration` | Trend | InsertSpec/bulk-load duration samples. Useful for load throughput analysis. |
| `insert_error_rate` | Rate | Insert failures during data loading. |
| `run_query_count` | Counter | SQL statements executed by the driver. |
| `run_query_duration` | Trend | SQL execution latency samples. Query samples are tagged by the active step. |
| `run_query_error_rate` | Rate | Query execution failure rate. |

Use the per-query stdout timings for Q1..Q22 latency comparisons. Use the common driver metrics for aggregate load/query behavior and error rates.

## Thresholds

TPC-H does not define k6 thresholds by default. The run is not auto-failed by a slow query threshold.

Answer validation is enabled for PostgreSQL/MySQL at `SCALE_FACTOR=1`. Mismatches and query errors are reported in the validation summary so you can compare correctness across runs and dialect changes.

## Query Parameters

TPC-H query parameters are pinned in `tpch/tx`; they are not exposed as environment overrides.

| Query | Pinned parameters |
|-------|-------------------|
| Q1 | `delta=90` |
| Q2 | `size=15`, `type=BRASS`, `region=EUROPE` |
| Q3 | `segment=BUILDING`, `date=1995-03-15` |
| Q4 | `date=1993-07-01` |
| Q5 | `region=ASIA`, `date=1994-01-01` |
| Q6 | `date=1994-01-01`, `discount=0.06`, `quantity=24` |
| Q7 | `nation1=FRANCE`, `nation2=GERMANY` |
| Q8 | `region=AMERICA`, `nation=BRAZIL`, `type=ECONOMY ANODIZED STEEL` |
| Q9 | `color=green` |
| Q10 | `date=1993-10-01` |
| Q11 | `nation=GERMANY`, `fraction=0.0001 / SCALE_FACTOR` |
| Q12 | `shipmode1=MAIL`, `shipmode2=SHIP`, `date=1994-01-01` |
| Q13 | `word1=special`, `word2=requests` |
| Q14 | `date=1995-09-01` |
| Q15 | `date=1996-01-01` |
| Q16 | `brand=Brand#45`, `type_prefix=MEDIUM POLISHED`, sizes `49,14,23,45,19,3,36,9` |
| Q17 | `brand=Brand#23`, `container=MED BOX` |
| Q18 | `quantity=300` |
| Q19 | `brand1=Brand#12`, `brand2=Brand#23`, `brand3=Brand#34`, quantities `1,10,20` |
| Q20 | `color=forest`, `nation=CANADA`, `date=1994-01-01` |
| Q21 | `nation=SAUDI ARABIA` |
| Q22 | country codes `13,31,23,29,30,18,17` |
