---
sidebar_position: 1
title: TPC-C
description: TPC-C workload structure, load model, variants, and parameters
---

# TPC-C

TPC-C is Stroppy's OLTP workload. It loads the standard warehouse schema and runs a mixed read/write transaction stream against it.

## Scripts

| Script | Drivers | Execution model |
|--------|---------|-----------------|
| `tpcc/tx` | PostgreSQL, MySQL, Picodata, YDB | Client-side transactions made from SQL steps. This is the portable default. |
| `tpcc/procs` | PostgreSQL, MySQL | Stored-procedure calls for each transaction type. Use this when you want server-side transaction bodies. |

Run the workload with normal Stroppy driver options and k6 arguments:

```bash
stroppy run tpcc/tx -d pg -D url=postgres://user:pass@host:5432/bench
stroppy run tpcc/tx -d pg -e warehouses=10 -- --vus 32 --duration 30m
stroppy run tpcc/procs -d mysql -D url=root:pass@tcp(host:3306)/bench
```

## Load Type

TPC-C is a sustained transactional workload. Setup creates and loads data once, then k6 runs the `workload` phase. Each k6 iteration chooses one transaction by weight:

| Transaction | Share | What it does |
|-------------|-------|--------------|
| New-Order | 45% | Creates a new customer order and order lines, updates stock, and may roll back on the required invalid-item case. |
| Payment | 43% | Updates warehouse, district, and customer balances, then inserts a history row. |
| Order-Status | 4% | Reads a customer's latest order and its order lines. |
| Delivery | 4% | Processes the oldest new order for each district and updates customer balances. |
| Stock-Level | 4% | Counts recently ordered items whose stock is below a threshold. |

By default Stroppy runs for raw throughput. Set `PACING=true` on `tpcc/tx` to add TPC-C keying and think-time delays.

## Data Model

The scale factor is the number of warehouses (`WAREHOUSES`, alias `SCALE_FACTOR`). For `W` warehouses, the load phase creates:

| Table | Rows |
|-------|------|
| `warehouse` | `W` |
| `district` | `10 * W` |
| `customer` | `30,000 * W` |
| `item` | `100,000` |
| `stock` | `100,000 * W` |
| `orders` | `30,000 * W` |
| `order_line` | `300,000 * W` |
| `new_order` | `9,000 * W` |
| `history` | Empty at load time; grows during Payment transactions. |

`order_line` currently uses 10 lines per order. This preserves the TPC-C mean but does not generate the full 5..15 per-order distribution.

## Steps

Select or skip setup phases with `--steps` and `--no-steps`.

| Step | Script | Description |
|------|--------|-------------|
| `drop_schema` | both | Drops existing TPC-C tables and functions/procedures. |
| `create_schema` | both | Creates the nine TPC-C tables from the selected SQL dialect file. |
| `create_procedures` | `tpcc/procs` | Creates stored procedures for PostgreSQL or MySQL. |
| `load_data` | both | Bulk-loads warehouse, district, customer, item, stock, orders, order_line, and new_order. |
| `create_indexes` | `tpcc/tx` | Builds post-load indexes when the dialect file defines them, mainly for YDB. |
| `validate_population` | both | Checks TPC-C consistency conditions and cardinalities before the workload starts. |
| `workload` | both | Runs the weighted transaction mix. |

Examples:

```bash
stroppy run tpcc/tx --steps drop_schema,create_schema,load_data
stroppy run tpcc/tx --no-steps drop_schema,create_schema,load_data
```

## SQL Files

When `SQL_FILE` is not set, the scripts choose a dialect file from the active driver type:

| Driver type | `tpcc/tx` SQL | `tpcc/procs` SQL |
|-------------|---------------|------------------|
| `postgres` | `tpcc/pg.sql` | `tpcc/pg.sql` |
| `mysql` | `tpcc/mysql.sql` | `tpcc/mysql.sql` |
| `picodata` | `tpcc/pico.sql` | Not supported |
| `ydb` | `tpcc/ydb.sql` | Not supported |

`tpcc/ydb_no_indexes.sql` is also embedded for YDB load-path comparisons. Pass an explicit SQL file to force a variant:

```bash
stroppy run tpcc/tx tpcc/pico -d pico
stroppy run tpcc/tx tpcc/ydb_no_indexes -d ydb
```

## Parameters

Workload parameters are passed as environment variables with `-e KEY=VALUE`. Keys are case-insensitive in the CLI.

| Parameter | Default | Script | Description |
|-----------|---------|--------|-------------|
| `POOL_SIZE` | `100` | both | Sets both `minConns` and `maxConns` for the primary driver pool. |
| `SCALE_FACTOR`, `WAREHOUSES` | `1` | both | Number of warehouses. `SCALE_FACTOR` and `WAREHOUSES` are aliases. |
| `LOAD_WORKERS` | `0` | `tpcc/tx` | Parallel InsertSpec workers during `load_data`. `0` lets the framework choose. |
| `RETRY_ATTEMPTS` | `3` | both | Maximum attempts for retryable serialization failures. `1` disables retries. |
| `PACING` | `false` | `tpcc/tx` | Enables TPC-C keying and think-time delays. Leave disabled for throughput runs. |
| `SQL_FILE` | auto | both | SQL file path. Defaults to a dialect file based on `driverType`. |
| `TX_ISOLATION` | auto | both | Overrides transaction isolation. Defaults are `repeatable_read` for PostgreSQL/MySQL, `none` for Picodata, and `serializable` for YDB. |
| `STROPPY_NO_DEFAULT` | `false` | `tpcc/tx` | Skips the transaction body in `default()`. Useful for load-only validation runs. |

Common runner controls also apply: `--steps`, `--no-steps`, `-d`/`-D` driver options, and k6 arguments after `--`.
