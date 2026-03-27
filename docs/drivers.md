---
sidebar_position: 3
title: Drivers & Configuration
description: Configuring database drivers, connection pools, presets, and multi-driver setups
---

# Drivers & Configuration

Every Stroppy test needs a database driver. This page covers how to configure one &mdash; from a single flag on the command line to fine-grained pool tuning and multi-driver setups.

## Quick Start

The fastest way to get a driver running is two lines of TypeScript:

```typescript
import { DriverX, declareDriverSetup } from "./helpers.ts";

const config = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
});

const driver = DriverX.create().setup(config);
```

`declareDriverSetup(0, {...})` declares driver slot 0 with defaults that the CLI can override. `DriverX.create().setup(config)` creates the driver and configures it. After this, `driver.exec(...)`, `driver.insert(...)`, and `driver.begin(...)` are all available.

Or skip TypeScript entirely &mdash; use a built-in preset from the command line:

```bash
stroppy run simple -d pg
```

## CLI Flags

Three flag families control drivers from the command line.

### `-d` / `--driver` &mdash; Driver Presets

Select a pre-configured driver by short name:

```bash
stroppy run tpcc -d pg
stroppy run tpcc -d mysql
stroppy run tpcc -d pico
```

The flag supports several syntax forms:

| Form | Example | Meaning |
|------|---------|---------|
| Space | `-d pg` | Driver 0, preset `pg` |
| Equals | `--driver=pg` | Driver 0, preset `pg` |
| Indexed (short) | `-d1 mysql` | Driver 1, preset `mysql` |
| Indexed (long) | `--driver1=mysql` | Driver 1, preset `mysql` |
| Raw JSON | `-d '{"driverType":"postgres","url":"..."}'` | Driver 0, inline config |

Without a number suffix, the index defaults to 0.

### `-D` / `--driver-opt` &mdash; Field Overrides

Override individual fields of a driver configuration:

```bash
stroppy run tpcc -d pg -D url=postgres://prod:5432/mydb
stroppy run tpcc -d mysql -D url=root:secret@tcp(db.local:3306)/bench
```

Like `-d`, this flag supports indexed and equals forms:

| Form | Example |
|------|---------|
| Space | `-D url=postgres://...` |
| Equals | `-D=url=postgres://...` |
| Indexed | `-D1 url=...` |
| Long form | `--driver-opt url=...` |
| Long indexed | `--driver1-opt url=...` |
| Long indexed equals | `--driver1-opt=url=...` |

Known override keys are `url`, `driverType`, and `defaultInsertMethod`. Any other key is passed through as-is to the TypeScript layer.

### `-e` / `--env` &mdash; Environment Overrides

Set environment variables for the test script:

```bash
stroppy run tpcc -e pool_size=200 -e scale_factor=10
```

Keys are **auto-uppercased** &mdash; `pool_size` becomes `POOL_SIZE` in the script. The flag accepts both space and equals forms:

```bash
-e SCALE_FACTOR=10
-e=SCALE_FACTOR=10
--env SCALE_FACTOR=10
--env=SCALE_FACTOR=10
```

See the [Environment Overrides](#-e-environment-overrides) section below for precedence rules.

## Driver Presets

Three presets are built in:

| Preset | `driverType` | Default URL | Default Insert Method |
|--------|-------------|-------------|----------------------|
| `pg` | `postgres` | `postgres://postgres:postgres@localhost:5432` | `copy_from` |
| `mysql` | `mysql` | `myuser:mypassword@tcp(localhost:3306)/mydb?charset=utf8mb4&parseTime=True&loc=Local` | `plain_bulk` |
| `pico` | `picodata` | `postgres://admin:T0psecret@localhost:1331` | `plain_bulk` |

Presets are case-insensitive. A preset sets defaults; you can override any field with `-D`:

```bash
# Use pg preset but connect to a different host
stroppy run tpcc -d pg -D url=postgres://user:pass@db.prod:5432/bench

# Use mysql preset but switch insert method
stroppy run tpcc -d mysql -D defaultInsertMethod=plain_query
```

## `declareDriverSetup` in Detail

```typescript
function declareDriverSetup(index: number, defaults: DriverSetup): DriverSetup;
```

This is the bridge between your TypeScript defaults and CLI overrides. It reads the `STROPPY_DRIVER_<index>` env var (set by `-d`/`-D` flags), parses it as JSON, and merges CLI values over your defaults. Fields not set by the CLI keep their script-defined values.

### `DriverSetup` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | `string` | &mdash; | Database connection URL |
| `driverType` | `"postgres"` \| `"mysql"` \| `"picodata"` | &mdash; | Which driver to use |
| `errorMode` | `"silent"` \| `"log"` \| `"throw"` \| `"fail"` \| `"abort"` | `"log"` | How query errors are handled |
| `defaultInsertMethod` | `"plain_query"` \| `"plain_bulk"` \| `"copy_from"` | `"plain_bulk"` | Insert strategy for `driver.insert()` |
| `defaultTxIsolation` | `"db_default"` \| `"read_uncommitted"` \| `"read_committed"` \| `"repeatable_read"` \| `"serializable"` \| `"conn"` \| `"none"` | `"db_default"` | Transaction isolation level for `driver.begin()` |
| `bulkSize` | `number` | `500` | Rows per bulk INSERT statement |
| `pool` | `PoolConfig` | &mdash; | Unified pool configuration sugar (see below) |
| `postgres` | `PostgresConfig` | &mdash; | PostgreSQL-specific pool settings |
| `sql` | `SqlConfig` | &mdash; | Generic SQL pool settings (MySQL) |

### Error modes

- **`silent`** &mdash; Record error metric only, no console output.
- **`log`** &mdash; Record metric + print to console. This is the default.
- **`throw`** &mdash; Rethrow the error. Your script must catch it.
- **`fail`** &mdash; Mark the k6 test as failed, continue execution (exit code 110).
- **`abort`** &mdash; Immediately stop the test via `test.abort()` (exit code 108).

Error mode precedence: `STROPPY_ERROR_MODE` env var > `config.errorMode` > default (`"log"`).

### Merge behavior

CLI fields override TypeScript defaults field-by-field. Only fields explicitly set in the CLI JSON are merged &mdash; everything else keeps the script's default value:

```typescript
// Script declares:
const config = declareDriverSetup(0, {
  url: "postgres://localhost:5432",
  driverType: "postgres",
  pool: { maxConns: 10, minConns: 2 },
});

// CLI: stroppy run test.ts -d pg -D url=postgres://prod:5432
// Result: url is overridden, driverType stays "postgres", pool stays {maxConns: 10, minConns: 2}
```

## Pool Configuration

The `pool` field provides a unified interface that maps to the correct driver-specific pool config based on `driverType`.

```typescript
const config = declareDriverSetup(0, {
  url: "postgres://localhost:5432",
  driverType: "postgres",
  pool: {
    maxConns: 20,
    minConns: 5,
    maxConnLifetime: "1h",
    maxConnIdleTime: "10m",
  },
});
```

### How `pool` maps to driver-specific config

For **postgres** and **picodata** (`driverType: "postgres"` or `"picodata"`), `pool` maps to `PostgresConfig`:

| `pool` field | `PostgresConfig` field |
|-------------|----------------------|
| `maxConns` | `maxConns` |
| `minConns` | `minConns` |
| `maxConnLifetime` | `maxConnLifetime` |
| `maxConnIdleTime` | `maxConnIdleTime` |

For **mysql** (`driverType: "mysql"`), `pool` maps to `SqlConfig`:

| `pool` field | `SqlConfig` field |
|-------------|------------------|
| `maxConns` | `maxOpenConns` |
| `minConns` | `maxIdleConns` |
| `maxConnLifetime` | `connMaxLifetime` |
| `maxConnIdleTime` | `connMaxIdleTime` |

### Explicit vs. sugar

If you set `postgres` or `sql` directly, they take priority over `pool`:

```typescript
// pool is ignored here — postgres takes priority
const config = declareDriverSetup(0, {
  url: "postgres://localhost:5432",
  driverType: "postgres",
  pool: { maxConns: 10 },       // ignored
  postgres: { maxConns: 20 },   // this wins
});
```

### Full `PostgresConfig` fields

When you need PostgreSQL-specific settings beyond what `pool` offers:

```typescript
const config = declareDriverSetup(0, {
  url: "postgres://localhost:5432",
  driverType: "postgres",
  postgres: {
    maxConns: 20,
    minConns: 5,
    minIdleConns: 3,
    maxConnLifetime: "1h",
    maxConnIdleTime: "10m",
    traceLogLevel: "warn",
    defaultQueryExecMode: "cache_statement",
    statementCacheCapacity: 512,
    descriptionCacheCapacity: 256,
  },
});
```

## Multi-Driver Setup

Stroppy supports multiple simultaneous database connections. This is useful for cross-database tests, migration validation, or comparing query plans across engines.

### From the CLI

Use indexed flags to configure multiple drivers:

```bash
stroppy run bench.ts -d0 pg -d1 mysql
stroppy run bench.ts -d pg -d1 pico -D1 url=postgres://admin:T0psecret@remote:1331
```

### In TypeScript

Each driver gets its own slot index:

```typescript
const pgConfig = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
  pool: { maxConns: 2, minConns: 2 },
});
const pgDriver = DriverX.create().setup(pgConfig);

const mysqlConfig = declareDriverSetup(1, {
  url: "root:pass@tcp(localhost:3306)/mydb",
  driverType: "mysql",
});
const mysqlDriver = DriverX.create().setup(mysqlConfig);
```

### Shared vs. per-VU drivers

Where you call `.setup()` determines sharing semantics:

- **Init phase** (top-level module scope) &mdash; The driver's connection pool is shared across all VUs. This is the common case.
- **Iteration phase** (inside `default()` or `setup()`) &mdash; Each VU gets its own driver instance and pool.

```typescript
// Shared: created at init, one pool for all VUs
const sharedDriver = DriverX.create().setup(sharedConfig);

// Per-VU: created at init, configured per iteration
const vuDriver = DriverX.create();

export default function () {
  vuDriver.setup({
    url: "postgres://localhost:5432?application_name=vu_" + exec.vu.idInTest,
    driverType: "postgres",
    pool: { maxConns: 1, minConns: 1 },
  });

  // Both drivers are usable here
  sharedDriver.exec("SELECT 1");
  vuDriver.exec("SELECT 1");
}
```

The `.setup()` call is safe to invoke on every iteration &mdash; it only configures the driver once.

## `-e` Environment Overrides

The `-e` flag sets environment variables that your test script can read via the `ENV()` helper or k6's `__ENV` object.

### Precedence

From highest to lowest priority:

1. **Real environment** &mdash; Variables already set in the shell (`export SCALE_FACTOR=100`). These always win. If a real env var exists, the `-e` value is silently ignored with a warning.
2. **`-e` overrides** &mdash; Values from the command line (`-e scale_factor=50`).
3. **Driver config** &mdash; Values from `-d`/`-D` flags (passed as `STROPPY_DRIVER_N` env vars).
4. **TypeScript defaults** &mdash; The fallback values in `declareDriverSetup()` and `ENV()`.

### Auto-uppercasing

All `-e` keys are uppercased before being set. This means these are equivalent:

```bash
stroppy run tpcc -e scale_factor=10
stroppy run tpcc -e SCALE_FACTOR=10
stroppy run tpcc -e Scale_Factor=10
```

All three set `SCALE_FACTOR=10` in the script environment.

### Multiple overrides

```bash
stroppy run tpcc -e scale_factor=10 -e pool_size=200 -e custom_flag=true
```

When the same key appears multiple times, the last value wins.

## Driver Types

Stroppy supports three database drivers. Each has different capabilities:

### `"postgres"`

Full-featured PostgreSQL driver built on [pgx](https://github.com/jackc/pgx).

- **Queries**: Full SQL support with `:param` syntax
- **Transactions**: All isolation levels
- **Insert methods**: `plain_query`, `plain_bulk`, `copy_from`
- **Pool config**: `PostgresConfig` (pgx pool)
- **COPY protocol**: Yes &mdash; use `copy_from` for bulk loads (5-10x faster than individual inserts)

### `"mysql"`

MySQL driver using Go's `database/sql` interface.

- **Queries**: Full SQL support with `:param` syntax
- **Transactions**: All isolation levels
- **Insert methods**: `plain_query`, `plain_bulk` (`copy_from` is **not supported**)
- **Pool config**: `SqlConfig` (database/sql pool)

### `"picodata"`

[Picodata](https://picodata.io/) driver using the PostgreSQL wire protocol.

- **Queries**: SQL support with `:param` syntax
- **Transactions**: **Not supported** (returns error)
- **Insert methods**: `plain_query`, `plain_bulk` (`copy_from` is **not supported**)
- **Pool config**: `PostgresConfig` (pgx pool, same as PostgreSQL)

### Capability matrix

| Capability | `postgres` | `mysql` | `picodata` |
|-----------|-----------|---------|-----------|
| `plain_query` insert | Yes | Yes | Yes |
| `plain_bulk` insert | Yes | Yes | Yes |
| `copy_from` insert | Yes | No | No |
| Transactions | Yes | Yes | No |
| `:param` syntax | Yes | Yes | Yes |
| Pool type | pgx | database/sql | pgx |

## How It Works Under the Hood

Understanding the plumbing helps when debugging configuration issues.

### The `STROPPY_DRIVER_N` mechanism

When you use `-d` and `-D` flags, the Go CLI:

1. Looks up the preset (if `-d` was used) to get base values (`driverType`, `url`, `defaultInsertMethod`).
2. Applies `-D` overrides field by field on top of the preset.
3. Serializes the result to JSON.
4. Sets it as the `STROPPY_DRIVER_0` environment variable (or `STROPPY_DRIVER_1`, etc.).

On the TypeScript side, `declareDriverSetup(0, defaults)` reads `STROPPY_DRIVER_0`, parses the JSON, and merges CLI values over script defaults. The merged config is then passed to `DriverX.create().setup(config)`, which converts it to the protobuf `DriverConfig` message and sends it to the Go driver layer.

```
CLI flags                    Environment              TypeScript
─────────                    ───────────              ──────────
-d pg                   →   STROPPY_DRIVER_0=        →   declareDriverSetup(0, defaults)
-D url=postgres://...        {"driverType":"postgres",     merges CLI JSON over defaults
                              "url":"postgres://...",  →   DriverX.create().setup(merged)
                              "defaultInsertMethod":       converts to protobuf
                              "copy_from"}             →   Go driver.Setup(proto)
```

### Why `declareDriverSetup` exists

It serves a dual purpose. At runtime, it merges CLI config over script defaults. During the **probe phase** (when Stroppy inspects a script without executing it), the `DeclareDriverSetup` spy function captures the declared defaults so the CLI can report what a script expects. This is how `stroppy probe` can show a script's driver requirements without running it.

### Pass-through fields

The `-D` flag accepts any `key=value` pair. Known fields (`url`, `driverType`, `defaultInsertMethod`) are set on the Go struct; everything else goes into an `Extra` map that is serialized into the JSON and passed through to TypeScript. This lets you define custom fields in your script and override them from the CLI:

```typescript
const config = declareDriverSetup(0, {
  url: "postgres://localhost:5432",
  driverType: "postgres",
});

// Access a custom CLI-provided field
const customTimeout = (config as any).queryTimeout ?? "30s";
```

```bash
stroppy run bench.ts -d pg -D queryTimeout=60s
```
