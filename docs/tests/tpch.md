---
sidebar_position: 2
title: TPC-H
description: TPC-H workload structure, load model, query suite, and parameters
---

# TPC-H

TPC-H is Stroppy's analytical workload. It bulk-loads the eight TPC-H tables and runs the 22 decision-support queries once.

## Script

TPC-H has one script: `tpch/tx`. It supports PostgreSQL, MySQL, Picodata, and YDB through dialect-specific SQL files.

```bash
stroppy run tpch/tx -d pg -D url=postgres://user:pass@host:5432/bench -e scale_factor=0.01
stroppy run tpch/tx -d mysql -D url=root:pass@tcp(host:3306)/bench -e scale_factor=0.01
stroppy run tpch/tx -d pg -e scale_factor=1
```

Use `SCALE_FACTOR=0.01` for smoke tests. Use `SCALE_FACTOR=1` when you want PostgreSQL answer validation against the embedded SF=1 reference answers.

## Load Type

TPC-H is a bulk-load plus query-suite workload, not a sustained per-iteration transaction loop. The setup phase:

1. Creates schema.
2. Loads all tables through InsertSpec.
3. Creates indexes and finalizes derived totals.
4. Executes Q1 through Q22 once.
5. Validates answers only for PostgreSQL at `SCALE_FACTOR=1`.

The exported `default()` function is intentionally empty; the work happens in setup steps.

## Data Model

For scale factor `SF`, Stroppy loads:

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

`orders.o_orderkey` follows the TPC-H sparse-key scheme. `orders.o_totalprice` is recomputed after lineitems are loaded because it depends on lineitem totals.

## Steps

| Step | Description |
|------|-------------|
| `drop_schema` | Drops the eight TPC-H tables. |
| `create_schema` | Creates `region`, `nation`, `part`, `supplier`, `partsupp`, `customer`, `orders`, and `lineitem`. |
| `load_data` | Bulk-loads all eight tables. |
| `set_logged` | PostgreSQL-only durability step for tables created as `UNLOGGED`; no-op or absent elsewhere. |
| `create_indexes` | Creates query-support indexes when defined by the dialect file. |
| `finalize_totals` | Recomputes `orders.o_totalprice` from loaded lineitems. |
| `queries` | Executes Q1 through Q22 once with pinned TPC-H parameters. |
| `validate_answers` | Compares query output with `answers_sf1.json` for PostgreSQL at `SCALE_FACTOR=1`; skips otherwise. |
| `workload` | Marker step around the empty k6 workload phase. |

Examples:

```bash
stroppy run tpch/tx --steps drop_schema,create_schema,load_data
stroppy run tpch/tx --no-steps drop_schema,create_schema,load_data
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

Workload parameters are passed as environment variables with `-e KEY=VALUE`. Keys are case-insensitive in the CLI.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `POOL_SIZE` | `50` | Sets both `minConns` and `maxConns` for the primary driver pool. |
| `SCALE_FACTOR` | `1` | TPC-H scale factor. Must be a positive number. `0.01` is supported for smoke tests. |
| `LOAD_WORKERS` | `0` | Parallel InsertSpec workers during `load_data`. `0` lets the framework choose. |
| `SQL_FILE` | auto | SQL file path. Defaults to a dialect file based on `driverType`. |
| `TX_ISOLATION` | auto | Isolation override kept for driver symmetry. Defaults are `read_committed` for PostgreSQL/MySQL, `none` for Picodata, and `serializable` for YDB. |
| `TPCH_QUERY_WARN_MS` | `60000` | During answer validation, logs a warning when a query takes longer than this many milliseconds. |

Common runner controls also apply: `--steps`, `--no-steps`, and `-d`/`-D` driver options.

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
