---
sidebar_position: 7
title: Built-in Workloads
description: TPC-B, TPC-C, TPC-DS, and other preset workloads with their parameters and variants
---

# Built-in Workloads

Stroppy ships with several preset workloads embedded directly in the binary. You can run any of them without writing a single line of code:

```bash
stroppy run tpcc
stroppy run tpcb
stroppy run tpcds tpcds-scale-100
stroppy run simple
stroppy run execute_sql
```

Each preset is a complete TypeScript test script bundled with its SQL files. Stroppy resolves them through the search path &mdash; see `stroppy help resolution` for the full lookup order.

## Available presets

| Preset | Description | Script variants | SQL variants |
|--------|-------------|-----------------|--------------|
| **tpcc** | TPC-C benchmark &mdash; 5 concurrent transaction types | `tpcc.ts`, `pick.ts`, `flat.ts` | `pg.sql`, `mysql.sql`, `ansi.sql` |
| **tpcb** | TPC-B benchmark &mdash; single transaction type | `tpcb.ts`, `flat.ts` | `tpcb.sql`, `ansi.sql` |
| **tpcds** | TPC-DS analytical queries | `tpcds.ts` | 10 scale-factor SQL files |
| **simple** | Minimal example demonstrating generators and driver API | `simple.ts` | none |
| **execute_sql** | Run arbitrary SQL files or inline queries | `execute_sql.ts` | user-provided |

---

## tpcb

The TPC-B workload models a simple banking transaction: update an account balance, update the teller and branch totals, and insert a history record. It is the workload behind `pgbench` and serves as a quick, well-understood stress test for transactional throughput.

### Running

```bash
stroppy run tpcb
stroppy run tpcb -e scale_factor=10
stroppy run tpcb -e scale_factor=10 -- --duration 5m --vus 32
```

### Parameters

| ENV variable | Default | Description |
|-------------|---------|-------------|
| `SCALE_FACTOR` (alias `BRANCHES`) | `1` | TPC-B scale factor. Determines the number of branches, tellers (10 &times; scale), and accounts (100,000 &times; scale). |
| `SQL_FILE` | `./tpcb.sql` | Path to the SQL file. Auto-set when you pass a `.sql` argument. |

### Steps

| Step | What it does |
|------|-------------|
| `cleanup` | Drops existing tables and the stored procedure |
| `create_schema` | Creates `pgbench_branches`, `pgbench_tellers`, `pgbench_accounts`, `pgbench_history` and their indexes |
| `create_procedures` | Creates the `tpcb_transaction` stored procedure (main script only) |
| `load_data` | Bulk-loads branches, tellers, and accounts using COPY, then runs `VACUUM ANALYZE` |
| `workload` | Runs the TPC-B transaction in a loop |

Skip or select steps with `--steps` and `--no-steps`:

```bash
stroppy run tpcb --no-steps cleanup,create_schema   # reuse existing data
stroppy run tpcb --steps workload                    # only the hot loop
```

### SQL variants

**`tpcb.sql`** (default) &mdash; Uses a PL/pgSQL stored procedure (`tpcb_transaction`) that wraps the entire transaction server-side. The workload section is a single `SELECT tpcb_transaction(...)` call. Best for PostgreSQL when you want to minimize round-trips.

**`ansi.sql`** &mdash; No stored procedures. The workload section contains five individual queries (`update_account`, `get_balance`, `update_teller`, `update_branch`, `insert_history`) that the script executes inside an explicit client-side transaction. Use this for databases that do not support PL/pgSQL, or when you want to measure per-statement latencies.

### Script variants

**`tpcb.ts`** (default) &mdash; The main script. Uses k6's default scenario (no explicit `scenarios` block). Calls the stored procedure from `tpcb.sql` once per iteration.

```bash
stroppy run tpcb                    # uses tpcb.ts + tpcb.sql
```

**`flat.ts`** &mdash; No stored procedures. Runs the five individual statements from `ansi.sql` inside `driver.beginTx()`. Defaults to `ansi.sql` and does not create or call procedures. Use this when targeting databases without PL/pgSQL or when you want client-side transaction control.

```bash
stroppy run tpcb/flat               # uses flat.ts + ansi.sql
```

---

## tpcc

The TPC-C workload is a full implementation of the TPC-C benchmark. It loads 9 tables (warehouse, district, customer, item, stock, orders, order_line, new_order, history) and runs 5 concurrent transaction types with a realistic mix ratio.

### Running

```bash
stroppy run tpcc
stroppy run tpcc -e scale_factor=10
stroppy run tpcc -e duration=30m -e vus_scale=2
stroppy run tpcc -d mysql
```

### Parameters

| ENV variable | Default | Description |
|-------------|---------|-------------|
| `SCALE_FACTOR` (alias `WAREHOUSES`) | `1` | Number of warehouses. Each warehouse adds 10 districts, 30,000 customers, and 100,000 stock rows. |
| `DURATION` | `1h` (`tpcc.ts`), `5m` (`flat.ts`) | How long the workload phase runs. |
| `VUS_SCALE` | `1` | Multiplier for the base VU counts across all five scenarios. |
| `POOL_SIZE` | `100` (`tpcc.ts`, `pick.ts`), `1` (`flat.ts`) | Connection pool size (both min and max). |
| `SQL_FILE` | auto-resolved | Path to the SQL file. When omitted, auto-selects based on driver type (see below). |

### Steps

| Step | What it does |
|------|-------------|
| `drop_schema` | Drops existing tables and stored procedures |
| `create_schema` | Creates all 9 TPC-C tables |
| `create_procedures` | Creates stored procedures (`tpcc.ts` and `pick.ts` only) |
| `load_data` | Bulk-loads item, warehouse, district, customer, and stock tables |
| `workload` | Runs the 5 transaction types concurrently |

### Transaction mix

The five transaction types run concurrently with the following VU distribution (at `VUS_SCALE=1`):

| Transaction | VUs | Percentage |
|------------|-----|-----------|
| `new_order` | 44 | 44% |
| `payments` | 43 | 43% |
| `order_status` | 4 | 4% |
| `delivery` | 4 | 4% |
| `stock_level` | 4 | 4% |

This matches the TPC-C specification mix. Adjust with `VUS_SCALE`:

```bash
stroppy run tpcc -e vus_scale=0.5    # halve all VU counts
stroppy run tpcc -e vus_scale=4      # quadruple (176 new_order VUs, etc.)
```

### SQL variants

**`pg.sql`** (default for PostgreSQL) &mdash; Uses PL/pgSQL stored procedures for all five transaction types. Includes the `dbms_random` utility function. Best performance on PostgreSQL.

**`mysql.sql`** (default for MySQL) &mdash; MySQL stored procedures with MySQL-specific syntax. Auto-selected when you use `-d mysql`.

**`ansi.sql`** (default for Picodata and `flat.ts`) &mdash; No stored procedures. Individual SELECT/INSERT/UPDATE/DELETE statements that the script executes directly. Works with any SQL-compatible database.

Auto-selection logic when `SQL_FILE` is not set:

| Driver type | SQL file selected |
|------------|------------------|
| `postgres` | `pg.sql` |
| `mysql` | `mysql.sql` |
| `picodata` | `ansi.sql` |

Override with an explicit second argument or `-e sql_file=...`:

```bash
stroppy run tpcc ansi              # force ansi.sql on any driver
stroppy run tpcc pg                # force pg.sql
```

### Script variants

**`tpcc.ts`** (default) &mdash; Full k6 scenarios with 5 named scenarios running concurrently via `constant-vus`. Each transaction type is a separate exported function (`new_order`, `payments`, `order_status`, `delivery`, `stock_level`), each with its own VU pool. Calls stored procedures from the SQL file.

```bash
stroppy run tpcc
```

**`pick.ts`** &mdash; Same setup and data loading as `tpcc.ts`, but instead of five parallel k6 scenarios, uses a single default export that picks a transaction at random on each iteration using weighted selection (44:43:4:4:4). All VUs share one scenario. This is useful when your k6 runner or output backend does not handle multiple scenarios well, or when you want a single-stream mix.

```bash
stroppy run tpcc/pick
```

**`flat.ts`** &mdash; No stored procedures. Implements all five transaction types as sequences of individual SQL statements executed via `driver.exec()`. Defaults to `ansi.sql`. Targets databases that lack stored procedure support (e.g., Picodata). Uses k6 `constant-vus` scenarios like the main script.

```bash
stroppy run tpcc/flat
```

---

## tpcds

The TPC-DS workload runs analytical (read-only) queries from the TPC-DS benchmark suite. Unlike TPC-B and TPC-C, it does **not** create tables or load data &mdash; it assumes you have already loaded a TPC-DS dataset at the desired scale factor. The script simply iterates over all queries in the provided SQL file and executes them sequentially.

### Running

```bash
stroppy run tpcds tpcds-scale-1
stroppy run tpcds tpcds-scale-100
stroppy run tpcds tpcds-scale-10000
```

The second argument selects the scale factor. This is required &mdash; there is no default SQL file, since the correct one depends on your dataset size.

### Parameters

| ENV variable | Default | Description |
|-------------|---------|-------------|
| `SQL_FILE` | (none) | Path to the SQL file. Set automatically from the second positional argument. |

### Available scale factors

The following SQL files are embedded and ready to use:

| Scale factor | File | Usage |
|-------------|------|-------|
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

Each file contains the full set of TPC-DS queries parameterized for that scale. The queries are named (`--= query_1`, `--= query_2`, ...) so individual query timings appear in the output.

### Execution model

The script runs with `vus: 1` and `iterations: 1` &mdash; a single pass through all queries. Each query is logged with its name before execution. This is designed for analytical benchmarking where you want to measure total query time rather than sustained throughput.

---

## simple

A minimal example script that demonstrates the core Stroppy APIs: driver connection, data generators (`R`, `S`, `C`), group generators, and query execution. It does not use any SQL file.

### Running

```bash
stroppy run simple
```

### What it does

1. Connects to a PostgreSQL instance at `localhost:5432`
2. Executes `select 1` as a basic connectivity check
3. Demonstrates `R.int32` (random), `R.str` with a fixed seed, `S.int32` (sequential), and `R.group` (Cartesian product)
4. Runs parameterized queries with `:param` syntax
5. Shows `driver.queryValue()` for retrieving a scalar result

The script runs once (`shared-iterations`, 1 VU, 1 iteration). It has no parameters beyond the driver defaults.

### Steps

| Step | What it does |
|------|-------------|
| `example` | Placeholder step demonstrating the `Step()` API |
| `workload` | The main execution phase |

---

## execute_sql

A generic runner that executes all queries from a SQL file or an inline SQL string. This is the script behind two of Stroppy's input modes:

```bash
# SQL file mode
stroppy run queries.sql

# Inline SQL mode
stroppy run "select count(*) from orders"
stroppy run "create table foo (id int)"
```

### Parameters

| ENV variable | Default | Description |
|-------------|---------|-------------|
| `SQL_FILE` | (none) | Path to the SQL file. Set automatically by Stroppy based on the input. |

### Execution model

The script runs with default k6 options (1 VU, 1 iteration unless overridden). It parses the SQL file with `parse_sql` (flat format, no sections), then iterates over every query and executes it via `driver.exec()`. This makes it suitable for schema setup, data migration scripts, or ad-hoc query execution.

---

## SQL file selection

Stroppy automatically derives which SQL file to use based on the preset name. The resolution works as follows:

1. If a second positional argument is given, Stroppy looks for that file (appending `.sql` if needed) through the standard search path. This **overrides** auto-derivation.
2. If no second argument is given and the script belongs to a preset, Stroppy looks for `<preset>.sql` &mdash; e.g., `tpcb.sql` for the `tpcb` preset.
3. If the SQL file is not found, the run proceeds without one (unless explicitly requested).

Additionally, some scripts implement their own fallback logic using `ENV.auto`. For example, the TPC-C main script auto-selects the SQL variant based on the active driver type (`pg.sql` for PostgreSQL, `mysql.sql` for MySQL, `ansi.sql` for Picodata).

You can always force a specific SQL file:

```bash
# Second positional argument
stroppy run tpcc ansi
stroppy run tpcds tpcds-scale-1000

# ENV override
stroppy run tpcc -e sql_file=./custom.sql
```

---

## Workload variants

Many presets ship with multiple script variants that share the same data loading logic but differ in how they execute the workload phase. The naming convention is:

| Variant | File | Description |
|---------|------|-------------|
| **Main** | `<preset>.ts` | Full k6 scenarios, typically using stored procedures. The default when you run `stroppy run <preset>`. |
| **pick** | `pick.ts` | Single k6 scenario that uses weighted random selection (`pickWeighted`) to choose a transaction type on each iteration. Same mix ratio as the main script. |
| **flat** | `flat.ts` | No stored procedures. Executes individual SQL statements directly, usually inside explicit client-side transactions. Defaults to `ansi.sql`. |

### When to use which

**Main** (`tpcc.ts`, `tpcb.ts`) &mdash; The standard choice. Uses k6's multi-scenario support to run transaction types with dedicated VU pools. Best when your database supports stored procedures and you want clean per-scenario metrics.

**pick** (`tpcc/pick.ts`) &mdash; Use when you need a single-scenario workload (simpler metrics, some output backends handle it better), but still want the standard transaction mix. All VUs share one scenario and each iteration randomly picks a transaction.

**flat** (`tpcc/flat.ts`, `tpcb/flat.ts`) &mdash; Use when targeting databases that lack stored procedure support, or when you want to see per-statement execution rather than per-procedure. The flat variants default to `ansi.sql` and issue all SQL as individual statements.

Run variants by including the directory path:

```bash
stroppy run tpcc              # tpcc/tpcc.ts (main)
stroppy run tpcc/pick         # tpcc/pick.ts
stroppy run tpcc/flat         # tpcc/flat.ts
stroppy run tpcb/flat         # tpcb/flat.ts
```
