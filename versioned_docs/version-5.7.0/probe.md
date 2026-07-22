---
sidebar_position: 6
title: Probe & Script Parameters
description: Inspecting workload scripts, discovering parameters, and filtering steps
---

# Probe & Script Parameters

`stroppy probe` runs a TypeScript benchmark script in a mocked k6 environment. It extracts metadata without connecting to a database, starting VUs, or executing the benchmark.

Use it to answer:

- Which SQL sections and queries does this script expect?
- Which environment variables does it declare?
- Which steps can I run or skip?
- Which k6 options and thresholds are exported?
- Which driver configuration is effective after config-file overrides?

## Catalog and Insert Methods

With no script argument, `stroppy probe` prints the embedded preset catalog and the insert methods each driver supports, without loading any script:

```bash
stroppy probe
stroppy probe -o json
```

The human output has two blocks. `PRESETS` lists each embedded preset and which of its scripts are runnable. `DRIVERS (supported insert methods)` lists the valid `defaultInsertMethod` values per database &mdash; `plain_query`, `plain_bulk`, `columnar`, `native` &mdash; so external tooling can discover them without reading Stroppy source:

```text
DRIVERS (supported insert methods)

  postgres  plain_query, plain_bulk, columnar, native
  mysql     plain_query, plain_bulk, native
  picodata  plain_query, plain_bulk, native
  ydb       plain_query, plain_bulk, columnar, native
  noop      plain_query, plain_bulk, columnar, native
  csv       native
```

In JSON output these are the `presets` and `drivers` keys (each driver entry carries an `insert_methods` list).

## Quick Usage

Probe accepts the same script and SQL resolution as `run`:

```bash
# Probe a built-in workload
stroppy probe tpcc/tx

# Probe a script by path
stroppy probe workloads/tpcc/procs.ts

# Probe with an explicit SQL file
stroppy probe workloads/tpcc/procs.ts workloads/tpcc/pg.sql

# Probe a JSON run config
stroppy probe -f stroppy-config.json --config --envs --drivers --steps
```

With no section flags, probe prints all sections. A typical `tpcc/tx` subset looks like this:

```
Use 'stroppy help probe' to get details about sections

# K6 Options:
{
  "setupTimeout": "5m",
  "summaryTrendStats": ["avg", "min", "med", "max", "p(1)", "p(5)", "p(10)", "p(90)", "p(95)", "p(99)"],
  "thresholds": {
    "tpcc_new_order_duration": ["p(90)<5000"],
    "tpcc_payment_duration": ["p(90)<5000"]
  }
}

# SQL File Structure:
  --+ drop_schema
  --= drop_item
  --= drop_warehouse
  ...

# Steps
  "drop_schema"
  "create_schema"
  "load_data"
  "create_indexes"
  "validate_population"
  "workload"

# Environment Variables:
  POOL_SIZE="" (default: 100)  # Connection pool size
  SCALE_FACTOR | WAREHOUSES="" (default: 1)  # Number of warehouses
  LOAD_WORKERS="" (default: 0)  # Load-time worker count per spec (0 = framework default)
  SQL_FILE="" (default: <auto>)  # SQL file path (defaults per driverType)

# Drivers:
  {
    "defaultInsertMethod": "native",
    "driverType": "postgres",
    "pool": {
      "maxConns": 100,
      "minConns": 100
    },
    "url": "postgres://postgres:postgres@localhost:5432"
  }
```

## What Probe Captures

| Section | Flag | What it captures |
|---------|------|------------------|
| Config | `--config` | Global Stroppy config loaded from a JSON config file. |
| Options | `--options` | The `export const options` k6 object. |
| SQL | `--sql` | SQL sections and named queries expected by the script. |
| Steps | `--steps` | Step names registered via `Step()`, `Step.begin()`, and `Step.end()`. |
| Envs | `--envs` | Variables declared via `ENV()` or read from `__ENV`. |
| Drivers | `--drivers` | Effective driver configuration returned by `declareDriverSetup()`. With `-f`, config-file drivers are applied before the script loads. |

By default all sections are shown. Pass one or more flags to narrow the output:

```bash
stroppy probe tpcc/tx --envs
stroppy probe tpcc/tx --sql --steps
stroppy probe tpch/tx --options --envs --drivers
```

## ENV() Declarations

`ENV()` is the standard way to declare and read script parameters. During probe, every call registers the variable names, default value, and description.

```typescript
const POOL_SIZE = ENV("POOL_SIZE", 100, "Connection pool size");
const WAREHOUSES = ENV(["SCALE_FACTOR", "WAREHOUSES"], 1, "Number of warehouses");
const SQL_FILE = ENV("SQL_FILE", ENV.auto, "SQL file path");
```

Signatures:

```typescript
ENV(name: string | string[], default?: string, description?: string): string;
ENV(name: string | string[], default?: number, description?: string): number;
ENV(name: string | string[], default: ENV.auto, description?: string): string | undefined;
```

If the environment variable is already set in your shell, probe shows that value instead of the default:

```bash
WAREHOUSES=10 stroppy probe tpcc/tx --envs
```

```
# Environment Variables:
  SCALE_FACTOR | WAREHOUSES=10  # Number of warehouses
```

## declareDriverSetup in Probe

Scripts declare driver defaults with `declareDriverSetup(index, defaults)`. The index identifies the driver slot, usually `0`.

```typescript
const driverConfig = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
  defaultInsertMethod: "native",
  pool: { maxConns: 100, minConns: 100 },
});
```

Probe prints the effective configuration. Without overrides this is the script default. With `-f`, config-file driver entries are exposed through `STROPPY_DRIVER_N` before the script is evaluated.

```bash
stroppy probe tpcc/tx --drivers
stroppy probe -f prod.json --drivers
```

For scripts that declare multiple driver slots, each slot is printed separately.

## Steps Discovery

Steps are named logical phases of a benchmark. They are registered with `Step()` in `setup()` or workload functions:

```typescript
export function setup() {
  Step("drop_schema", () => {
    sql("drop_schema").forEach((query) => driver.exec(query, {}));
  });

  Step("load_data", () => {
    driver.insertSpec(accountsSpec());
  });

  Step.begin("workload");
}
```

Probe lists them in declaration order:

```bash
stroppy probe tpcb/tx --steps
```

```
# Steps
  "drop_schema"
  "create_schema"
  "load_data"
  "workload"
```

## `--steps` and `--no-steps`

Use `--steps` to run only a subset, or `--no-steps` to skip a subset. The flags are mutually exclusive.

```bash
# Only create schema and load data
stroppy run tpcc/tx --steps create_schema,load_data

# Run everything except the schema drop
stroppy run tpcc/tx --no-steps drop_schema
```

Stroppy validates step names against the script's declared steps before launching k6. Unknown names are rejected immediately.

Under the hood, these flags set `STROPPY_STEPS` and `STROPPY_NO_STEPS`, and the Step helper filters execution.

## JSON Output

Use `-o json` for automation:

```bash
stroppy probe tpch/tx -o json
```

The JSON output includes keys such as `global_config`, `options`, `sql_sections`, `steps`, `envs`, `env_declarations`, `driver_setups`, and `drivers`. Section filter flags do not remove keys from JSON output.

## Local Imports

By default, probe copies scripts into a temporary directory. Use `--local` when a script imports local modules that must resolve relative to the source tree.

```bash
stroppy probe workloads/tpcc/procs.ts --local
```

## Common Workflows

```bash
# Discover setup phases before loading data
stroppy probe tpcc/tx --steps

# Inspect all workload knobs
stroppy probe tpcc/tx --envs

# Inspect required SQL sections for a new dialect
stroppy probe workloads/tpcc/procs.ts --sql

# Validate a config file before running
stroppy probe -f stroppy-config.json --config --envs --drivers --steps
```
