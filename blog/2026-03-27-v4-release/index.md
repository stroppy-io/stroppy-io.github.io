---
slug: stroppy-v4-release
title: "Stroppy v4.0.0: Transactions, CLI Overhaul, and Built-in Help"
authors: [stroppy-authors]
tags: [release, transactions, cli, drivers]
---

Stroppy v4.0.0 is a major release that adds database transactions, reworks the CLI from the ground up, and ships a built-in help system. If you've been using v3.1.0, this post covers everything that changed and why.

{/* truncate */}

## Transactions

The headline feature. Stroppy now supports database transactions with configurable isolation levels, automatic commit/rollback, and per-transaction metrics.

Two API styles are available:

```typescript
// Callback form — auto-commit on success, auto-rollback on error
driver.beginTx({ isolation: "serializable", name: "transfer" }, (tx) => {
  tx.exec("UPDATE accounts SET balance = balance - :amt WHERE id = :src", {
    src: 1, amt: 100,
  });
  tx.exec("UPDATE accounts SET balance = balance + :amt WHERE id = :dst", {
    dst: 2, amt: 100,
  });
});

// Manual form — you control the lifecycle
const tx = driver.begin({ isolation: "read_committed" });
try {
  tx.exec("INSERT INTO log (msg) VALUES (:m)", { m: "started" });
  tx.commit();
} catch (e) {
  tx.rollback();
  throw e;
}
```

Seven isolation levels are supported: the four standard SQL levels (`read_uncommitted`, `read_committed`, `repeatable_read`, `serializable`), plus `db_default`, `conn` (dedicated connection without `BEGIN`), and `none` (no transaction, no connection pinning).

Every transaction automatically tracks `tx_total_duration`, `tx_clean_duration`, `tx_commit_rate`, `tx_error_rate`, and `tx_queries_per_tx`. These appear in the web dashboard and HTML reports alongside standard k6 metrics, tagged by transaction name and isolation level.

Inside a transaction, errors always throw regardless of the configured error mode — this ensures the rollback path in `beginTx` fires correctly. The error mode (`fail`, `abort`, etc.) takes effect after the transaction error propagates out.

Full details: [Transactions](/docs/4.0.0/transactions).

## CLI Overhaul

### Driver presets and overrides

Three flag families now control driver configuration from the command line:

```bash
# -d selects a preset
stroppy run tpcc -d pg
stroppy run tpcc -d mysql
stroppy run tpcc -d pico

# -D overrides individual fields
stroppy run tpcc -d pg -D url=postgres://prod:5432/mydb

# Multi-driver: indexed flags
stroppy run bench.ts -d pg -d1 mysql

# Raw JSON config
stroppy run tpcc -d '{"driverType":"postgres","url":"postgres://prod:5432"}'
```

Driver presets come with sensible defaults for local development — URL, credentials, insert method — so you can go from zero to running a benchmark in one flag. Override any field with `-D`.

### Environment overrides

The new `-e` flag sets environment variables that scripts read via the `ENV()` helper:

```bash
stroppy run tpcc -e scale_factor=10 -e pool_size=200
```

Keys are auto-uppercased: `-e pool_size=200` sets `POOL_SIZE=200`. Real environment variables always take precedence over `-e` values, so you can't accidentally override something the shell has set.

Full CLI reference: [CLI Reference](/docs/4.0.0/cli-reference).

### Built-in help

`stroppy help` now ships six reference topics, accessible without leaving the terminal:

```bash
stroppy help drivers      # presets, options, multi-driver config
stroppy help envs         # ENV() function, precedence, auto-uppercasing
stroppy help probe        # probe sections, flags, output formats
stroppy help resolution   # how stroppy finds scripts and SQL files
stroppy help sql          # SQL file format, sections, parameters
stroppy help steps        # defining, filtering, discovering steps
```

Each topic is a self-contained reference with examples.

## Error Modes: `fail` and `abort`

v3.1.0 had three error modes: `silent`, `log`, and `throw`. v4.0.0 adds two more:

- **`fail`** — marks the current k6 iteration as failed and continues execution (exit code 110)
- **`abort`** — immediately stops the entire test run (exit code 108)

Set them per-driver via `declareDriverSetup`, the `-D` flag, or globally with the `STROPPY_ERROR_MODE` environment variable.

More on error handling: [Drivers & Configuration](/docs/4.0.0/drivers#error-modes).

## Workload Reorganization

The built-in workloads have been restructured for consistency across databases.

### TPC-C

- `tpcc.sql` &rarr; `pg.sql` (PostgreSQL stored procedures)
- `pico.sql` &rarr; `ansi.sql` (no stored procedures, works everywhere)
- `pico.ts` &rarr; `flat.ts` (individual SQL statements, no stored procedures)
- Removed `pick-mysql.ts` — the main `pick.ts` now handles all drivers via auto-selection

Run variants with directory paths:

```bash
stroppy run tpcc              # tpcc.ts + pg.sql (PostgreSQL default)
stroppy run tpcc/pick         # single-scenario weighted random mix
stroppy run tpcc/flat         # no stored procedures, uses ansi.sql
stroppy run tpcc -d mysql     # auto-selects mysql.sql
```

### TPC-B

New `flat.ts` and `ansi.sql` variants that run TPC-B without stored procedures:

```bash
stroppy run tpcb              # tpcb.ts + tpcb.sql (stored procedure)
stroppy run tpcb/flat         # flat.ts + ansi.sql (individual statements)
```

All presets: [Built-in Workloads](/docs/4.0.0/presets).

## Driver Internals

### Shared `sqldriver` package

The PostgreSQL and Picodata drivers now share a common `sqldriver` package that handles `RunQuery`, `InsertValues`, and `Teardown`. Adding a new `database/sql`-compatible driver means implementing a `Dialect` interface (just `Placeholder` and `ValueToAny`) and registering it — the shared package handles the rest.

The `bulkSize` configuration has been unified across all drivers at the proto level instead of being driver-specific.

How to add a driver: [Extensibility](/docs/4.0.0/extensibility).

### `conn` isolation unification

The `CONNECTION_ONLY` transaction level (acquire a raw connection without `BEGIN`) now uses a consistent implementation across all drivers, instead of each driver handling it separately.

## TypeScript Layer

### `ENV()` helper

The new `ENV()` function replaces direct `__ENV` access for script parameters. It registers metadata (names, defaults, descriptions) that `stroppy probe --envs` can display:

```typescript
const WAREHOUSES = ENV(["SCALE_FACTOR", "WAREHOUSES"], 1, "Number of warehouses");
const SQL_FILE = ENV("SQL_FILE", ENV.auto, "SQL file path");
```

`ENV.auto` signals that the script resolves the value itself at runtime (e.g., picking an SQL file based on driver type). Probe shows `(default: <auto>)` for these.

Discover parameters before running: [Probe & Script Parameters](/docs/4.0.0/probe).

### Type checking

TypeScript type definitions (`stroppy.d.ts`, `tsconfig.json`) are now included in generated workspaces. The CI pipeline runs `tsc --noEmit` to catch type errors before they reach runtime.

## CI

- **Smoke tests with real databases** — PostgreSQL and MySQL integration tests run in CI, not just unit tests
- **TypeScript typecheck** — `tsc` runs against workload scripts to catch type errors early

## Upgrading from v3.1.0

1. **Driver configuration**: If you were passing driver config through environment variables or TypeScript defaults, everything still works. The new `-d`/`-D` flags are additive — they provide a more convenient way to do what was previously manual.

2. **Workload file renames**: If you reference TPC-C SQL files by path, update them:
   - `tpcc.sql` &rarr; `pg.sql`
   - `pico.sql` &rarr; `ansi.sql`
   - `pico.ts` &rarr; `flat.ts`

3. **`pick-mysql.ts` removed**: Use `pick.ts` with `-d mysql` instead. The script auto-selects the correct SQL file.

4. **`__ENV` access**: Still works but `ENV()` is preferred for new code — it enables `stroppy probe --envs` discovery and provides typed defaults.

## Links

- [GitHub Release](https://github.com/stroppy-io/stroppy/releases/tag/v4.0.0)
- [Introduction & Quick Start](/docs/4.0.0/introduction)
- [CLI Reference](/docs/4.0.0/cli-reference)
- [Transactions](/docs/4.0.0/transactions)
- [Drivers & Configuration](/docs/4.0.0/drivers)
- [Built-in Workloads](/docs/4.0.0/presets)
- [Probe & Script Parameters](/docs/4.0.0/probe)
- [Extensibility](/docs/4.0.0/extensibility)
