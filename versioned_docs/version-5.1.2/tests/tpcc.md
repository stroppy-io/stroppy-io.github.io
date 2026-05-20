---
sidebar_position: 1
title: TPC-C
description: TPC-C workload structure, load model, variants, and parameters
---

# TPC-C

TPC-C is Stroppy's OLTP workload. It loads the standard warehouse schema and runs a mixed read/write transaction stream against it.

It simulates a wholesale supplier with warehouses, districts, customers, orders, stock, and payments. The workload is designed to show how a database behaves under short concurrent transactions that update shared rows, maintain secondary records, and mix reads with writes.

Use TPC-C to evaluate:

- Transaction throughput under contention.
- Commit latency and tail latency for short OLTP transactions.
- Locking, deadlock, and serialization retry behavior.
- Primary-key and secondary-index lookup performance.
- Write amplification from updates plus history/order-line inserts.
- Connection-pool and concurrency scaling as VUs increase.

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

The workload is write-heavy and contention-sensitive. New-Order and Payment drive most of the write load; Order-Status and Stock-Level add read paths that depend on recent order and stock indexes; Delivery performs batch-like updates across districts.

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
| `drop_schema` | both | Removes existing TPC-C tables and, for `tpcc/procs`, stored routines. This gives the next load a clean schema instead of appending to old benchmark data. |
| `create_schema` | both | Executes the selected dialect DDL and creates the nine TPC-C tables: warehouse, district, customer, item, stock, orders, order_line, new_order, and history. |
| `create_procedures` | `tpcc/procs` | Creates the server-side transaction procedures for PostgreSQL or MySQL. `tpcc/tx` does not use this step because it runs transaction bodies from client-side SQL. |
| `load_data` | both | Bulk-loads the initial TPC-C population through InsertSpec: warehouses, districts, customers, items, stock, orders, order lines, and new orders. `history` starts empty and grows during Payment transactions. |
| `create_indexes` | `tpcc/tx` | Builds optional post-load indexes from the SQL file. This is mainly used by YDB for customer-name and latest-order lookups, and is delayed until after load to avoid index maintenance during bulk insert. |
| `validate_population` | both | Runs pre-workload safety checks and fails setup if loaded data is inconsistent. It verifies expected row counts for the scale factor, TPC-C CC1-CC4 relationships, contiguous `new_order` ranges, `order_line` totals, required fixed values, and sanity bands such as `ORIGINAL` rows and bad-credit customers. |
| `workload` | both | Starts the k6 workload phase. Each iteration picks one of the five transaction types by the configured TPC-C weights and records workload-specific metrics and thresholds. |

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

## Metrics

TPC-C emits workload-specific counters and trends in addition to standard k6 and Stroppy driver metrics.

| Metric | Type | Description |
|--------|------|-------------|
| `tpcc_new_order_total` | Counter | New-Order transactions attempted. |
| `tpcc_payment_total` | Counter | Payment transactions attempted. |
| `tpcc_order_status_total` | Counter | Order-Status transactions attempted. |
| `tpcc_delivery_total` | Counter | Delivery transactions attempted. |
| `tpcc_stock_level_total` | Counter | Stock-Level transactions attempted. |
| `tpcc_rollback_decided` | Counter | New-Order transactions selected for the required invalid-item rollback path. |
| `tpcc_rollback_done` | Counter | New-Order rollbacks actually observed. Expected around 1% of New-Order. |
| `tpcc_remote_line_total` | Counter | New-Order order-line decisions observed by `tpcc/tx`. |
| `tpcc_remote_line_remote` | Counter | New-Order lines supplied by a remote warehouse. Expected around 1% of lines. |
| `tpcc_payment_remote` | Counter | Payments against a remote warehouse. Expected around 15% of Payment. |
| `tpcc_payment_byname` | Counter | Payments that look up customers by last name. Expected around 60% of Payment. |
| `tpcc_payment_bc` | Counter | Payments for bad-credit customers. Expected around 10% of Payment; client-observed in `tpcc/tx`. |
| `tpcc_order_status_byname` | Counter | Order-Status lookups by customer last name. Expected around 60% of Order-Status. |
| `tpcc_retry_attempts` | Counter | Serialization/deadlock retries performed by the retry helper. |
| `tpcc_new_order_duration` | Trend | End-to-end New-Order latency in milliseconds. |
| `tpcc_payment_duration` | Trend | End-to-end Payment latency in milliseconds. |
| `tpcc_order_status_duration` | Trend | End-to-end Order-Status latency in milliseconds. |
| `tpcc_delivery_duration` | Trend | End-to-end Delivery latency in milliseconds. |
| `tpcc_stock_level_duration` | Trend | End-to-end Stock-Level latency in milliseconds. |

The summary also reports observed transaction mix, compliance ratios, retry count, and driver-layer metrics such as `run_query_count`, `run_query_duration`, `run_query_error_rate`, `tx_total_duration`, `tx_clean_duration`, `tx_queries_per_tx`, `tx_commit_rate`, and `tx_error_rate`.

## Thresholds

TPC-C defines k6 thresholds on transaction latency trends. A threshold failure makes the k6 run fail.

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| `tpcc_new_order_duration` | `p(90)<5000` | 90% of New-Order transactions must complete under 5s. |
| `tpcc_payment_duration` | `p(90)<5000` | 90% of Payment transactions must complete under 5s. |
| `tpcc_order_status_duration` | `p(90)<5000` | 90% of Order-Status transactions must complete under 5s. |
| `tpcc_stock_level_duration` | `p(90)<20000` | 90% of Stock-Level transactions must complete under 20s. |
| `tpcc_delivery_duration` | `p(90)<80000` | 90% of Delivery transactions must complete under 80s. |

The summary also prints a statistical check for the 45/43/4/4/4 transaction mix. That check is informational; the process exit code is controlled by k6 thresholds and runtime errors.
