---
sidebar_position: 6
title: Probe & Script Parameters
description: Inspecting workload scripts, discovering parameters, and filtering steps
---

# Probe & Script Parameters

Before launching a benchmark, you often need to know what a script expects: which environment variables it reads, what SQL sections it needs, what steps it defines, and how its driver is configured. The `stroppy probe` command answers all of these questions without connecting to any database.

## Quick Usage

Probe accepts the same name resolution as `run` &mdash; preset names, full paths, or a script plus an SQL file:

```bash
# Probe a preset by name
stroppy probe tpcc

# Probe a script by path
stroppy probe workloads/tpcc/tpcc.ts

# Probe with an explicit SQL file
stroppy probe workloads/tpcc/tpcc.ts workloads/tpcc/pg.sql
```

With no section flags, probe prints all sections:

```
Use 'stroppy help probe' to get details about sections

# Stroppy Config:
  (no config)

# K6 Options:
{
  "scenarios": {
    "new_order": {
      "executor": "constant-vus",
      "exec": "new_order",
      "vus": 44,
      "duration": "1h"
    },
    ...
  }
}

# SQL File Structure:
  --+ drop_schema
  --= drop_item
  --= drop_warehouse
  ...
  --+ create_schema
  --= create_warehouse
  ...

# Steps
  "drop_schema"
  "create_schema"
  "create_procedures"
  "load_data"
  "workload"

# Environment Variables:
  DURATION="" (default: 1h)  # Test duration
  VUS_SCALE="" (default: 1)  # VU scaling factor
  POOL_SIZE="" (default: 100)  # Connection pool size
  SCALE_FACTOR | WAREHOUSES="" (default: 1)  # Number of warehouses
  SQL_FILE=""  # SQL file path (auto-resolved by driver type if omitted)

# Drivers:
  {
    "url": "postgres://postgres:postgres@localhost:5432",
    "driverType": "postgres",
    "defaultInsertMethod": "copy_from",
    "pool": {
      "maxConns": 100,
      "minConns": 100
    }
  }
```

## What Probe Does

Probe runs your TypeScript script inside a lightweight JavaScript VM with every external dependency mocked out. No database connection is opened, no k6 engine is started, and no VUs are spawned. Instead, the VM intercepts calls to framework functions &mdash; `ENV()`, `declareDriverSetup()`, `Step()`, `parse_sql_with_sections()` &mdash; and records the arguments they receive.

The result is a `Probeprint` structure that captures six sections of metadata:

| Section | Flag | What it captures |
|---------|------|------------------|
| Config | `--config` | Stroppy global configuration (protojson) |
| Options | `--options` | The `export const options` k6 object |
| SQL | `--sql` | SQL sections and named queries |
| Steps | `--steps` | Step names registered via `Step()` |
| Envs | `--envs` | Environment variables declared via `ENV()` or `__ENV` |
| Drivers | `--drivers` | Driver defaults from `declareDriverSetup()` |

By default all sections are shown. Pass one or more flags to narrow the output:

```bash
# Show only environment variables
stroppy probe tpcc --envs

# Show SQL structure and steps together
stroppy probe tpcc --sql --steps
```

## ENV() Declarations

The `ENV()` function is the standard way to declare script parameters. It reads from k6's `__ENV` object at runtime, but during probe it also registers metadata &mdash; the variable name(s), default value, and description &mdash; so that `stroppy probe --envs` can list them.

### Signatures

```typescript
// String parameter with a string default
ENV(name: string | string[], default?: string, description?: string): string;

// Numeric parameter with a number default
ENV(name: string | string[], default?: number, description?: string): number;

// Auto-default: returns undefined if the env var is not set
ENV(name: string | string[], default: ENV.auto, description?: string): string | undefined;
```

### Examples

```typescript
// Simple string parameter — defaults to "1h" if DURATION is not set
const DURATION = ENV("DURATION", "1h", "Test duration");

// Numeric parameter — defaults to 1, returned as a number
const WAREHOUSES = ENV("WAREHOUSES", 1, "Number of warehouses");

// Multiple names — first match wins (useful for aliases)
const SCALE = ENV(["SCALE_FACTOR", "WAREHOUSES"], 1, "Number of warehouses");

// Auto default — returns undefined when unset, so the script can branch
const SQL_FILE = ENV("SQL_FILE", ENV.auto, "SQL file path");
```

When probe runs, each `ENV()` call registers an `EnvDeclaration` with the name(s), default, and description. The `--envs` section then displays them:

```
# Environment Variables:
  DURATION="" (default: 1h)  # Test duration
  WAREHOUSES="" (default: 1)  # Number of warehouses
  SCALE_FACTOR | WAREHOUSES="" (default: 1)  # Number of warehouses
  SQL_FILE=""  # SQL file path
```

If the environment variable is already set in your shell, probe shows its current value instead of the default:

```bash
export WAREHOUSES=10
stroppy probe tpcc --envs
```

```
# Environment Variables:
  ...
  SCALE_FACTOR | WAREHOUSES=10  # Number of warehouses
  ...
```

## declareDriverSetup in Probe

Scripts declare their driver configuration with `declareDriverSetup(index, defaults)`. The `index` identifies which driver slot this configures (most scripts use a single driver at index `0`). The `defaults` object contains the script's starting-point configuration &mdash; driver type, URL, pool sizes, insert method &mdash; before any CLI overrides (`-d`, `-D`) are applied.

```typescript
const driverConfig = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
  defaultInsertMethod: "copy_from",
  pool: { maxConns: 100, minConns: 100 },
});
```

During probe, the `DeclareDriverSetup` spy captures the index and defaults map. The `--drivers` section prints them as JSON:

```bash
stroppy probe tpcc --drivers
```

```
# Drivers:
  {
    "url": "postgres://postgres:postgres@localhost:5432",
    "driverType": "postgres",
    "defaultInsertMethod": "copy_from",
    "pool": {
      "maxConns": 100,
      "minConns": 100
    }
  }
```

For scripts that use multiple drivers (e.g., index `0` for PostgreSQL and index `1` for MySQL), each driver is listed separately with its index:

```
# Drivers:
  ## Driver 0:
  { ... }

  ## Driver 1:
  { ... }
```

## Steps Discovery

Steps are named logical phases of a benchmark. They are registered via `Step()` in the `setup()` or `default()` function:

```typescript
export function setup() {
  Step("drop_schema", () => {
    sql("drop_schema").forEach((query) => driver.exec(query, {}));
  });

  Step("create_schema", () => {
    sql("create_schema").forEach((query) => driver.exec(query, {}));
  });

  Step("load_data", () => {
    driver.insert("orders", COUNT, { params: { ... } });
  });

  Step.begin("workload");
}
```

During probe, every `Step()` call and every `Step.begin()` / `Step.end()` call registers the step name. Probe lists them in declaration order:

```bash
stroppy probe tpcc --steps
```

```
# Steps
  "drop_schema"
  "create_schema"
  "create_procedures"
  "load_data"
  "workload"
```

## --steps and --no-steps

The `--steps` and `--no-steps` flags on `stroppy run` let you run only a subset of the declared steps. These two flags are mutually exclusive.

### Run only specific steps

```bash
# Only create the schema and load data
stroppy run tpcc --steps create_schema,load_data
```

Steps not in the list are skipped with a log message: `Skipping step 'drop_schema'`.

### Skip specific steps

```bash
# Run everything except the schema drop
stroppy run tpcc --no-steps drop_schema
```

### How it works

Under the hood, `--steps step1,step2` sets the environment variable `STROPPY_STEPS=step1,step2`, and `--no-steps step1,step2` sets `STROPPY_NO_STEPS=step1,step2`. The `Step()` function in `helpers.ts` reads these at module load time and builds filter sets:

```typescript
const _stepFilter: Set<string> | null = (() => {
  const only = ENV("STROPPY_STEPS", "", "comma-separated list of steps to run (allowlist), same as --steps");
  if (only) return new Set(only.split(","));
  return null;
})();

const _stepSkip: Set<string> | null = (() => {
  const skip = ENV("STROPPY_NO_STEPS", "", "comma-separated list of steps to skip (blocklist), same as --no-steps");
  if (skip) return new Set(skip.split(","));
  return null;
})();
```

When `Step(name, fn)` is called, it checks `isStepEnabled(name)` &mdash; if a filter set exists and does not include the name, the function body is skipped entirely.

### Discover, then filter

A typical workflow: first probe to see what steps exist, then run with a filter:

```bash
# What steps does tpcc define?
stroppy probe tpcc --steps

# Run only schema setup, skip the actual benchmark
stroppy run tpcc --steps drop_schema,create_schema,create_procedures

# Re-run only the data load (schema already exists)
stroppy run tpcc --steps load_data
```

Stroppy validates step names before launching k6 &mdash; if you pass `--steps foo` and the script does not define a step named `foo`, the run fails immediately with an error.

## -e Interaction with Probe

The `-e KEY=VALUE` flag on `stroppy run` sets environment variables that the script can read via `ENV()`. The key is automatically uppercased &mdash; `-e pool_size=200` sets `POOL_SIZE=200`.

To discover what parameters a script accepts before running:

```bash
# See all environment variables the script declares
stroppy probe tpcc --envs
```

```
# Environment Variables:
  DURATION="" (default: 1h)  # Test duration
  VUS_SCALE="" (default: 1)  # VU scaling factor
  POOL_SIZE="" (default: 100)  # Connection pool size
  SCALE_FACTOR | WAREHOUSES="" (default: 1)  # Number of warehouses
  SQL_FILE=""  # SQL file path (auto-resolved by driver type if omitted)
```

Then pass overrides on the run:

```bash
stroppy run tpcc -e scale_factor=10 -e duration=30m -e pool_size=200
```

Precedence rules: if a real environment variable is already set in the shell (e.g., `export POOL_SIZE=50`), the `-e` override is ignored and a warning is logged. This ensures the real environment always wins.

## Output Formats

Probe supports two output formats, selected with `-o`:

### Human-readable (default)

```bash
stroppy probe tpcc -o human
```

Prints labeled sections with indentation, as shown in the examples above. Section filter flags (`--config`, `--options`, `--sql`, `--steps`, `--envs`, `--drivers`) control which sections appear.

### JSON

```bash
stroppy probe tpcc -o json
```

Outputs the entire `Probeprint` structure as a single JSON object. All sections are included regardless of filter flags. Top-level keys:

| Key | Description |
|-----|-------------|
| `global_config` | Stroppy global configuration (protojson encoding) |
| `options` | k6 options object |
| `sql_sections` | Array of `{ name, queries: [{ name, text }] }` |
| `steps` | Array of step name strings |
| `envs` | Legacy `__ENV` accesses (plain strings) |
| `env_declarations` | Array of `{ names, default, description }` |
| `driver_setups` | Array of `{ index, defaults }` |
| `drivers` | Array of resolved `DriverConfig` (protojson encoding) |

JSON output is useful for CI pipelines and tooling that needs to parse script metadata programmatically.

## The --local Flag

By default, probe copies the script and its dependencies into a temporary directory to resolve imports cleanly. Pass `--local` (`-l`) to skip the temp directory and resolve imports relative to the script's own location:

```bash
stroppy probe workloads/tpcc/tpcc.ts --local
```

Use `--local` when the script imports local modules that are not bundled into the binary and must be resolved from the source tree.

## Use Cases

### CI validation

Run `stroppy probe` in CI to verify that scripts are structurally valid before deploying them. JSON output makes it easy to assert on specific fields:

```bash
# Fail CI if the script declares no steps
STEPS=$(stroppy probe tpcc -o json | jq '.steps | length')
if [ "$STEPS" -eq 0 ]; then
  echo "ERROR: script declares no steps"
  exit 1
fi
```

### Discovering script parameters

Before running an unfamiliar workload, probe tells you everything you need to know:

```bash
# What does this script need?
stroppy probe tpcc

# What environment variables can I tune?
stroppy probe tpcc --envs

# What SQL does it expect?
stroppy probe tpcc --sql
```

### Checking SQL resolution

When pairing a script with an SQL file, probe shows the SQL structure the script expects. This is useful for verifying that a custom SQL file matches the script's expectations:

```bash
stroppy probe tpcc workloads/tpcc/pg.sql --sql
```

### Planning step-based runs

Use probe to see the step list, then build incremental runs:

```bash
# See all steps
stroppy probe tpcc --steps

# Step 1: create the schema
stroppy run tpcc --steps drop_schema,create_schema,create_procedures

# Step 2: load data (can be re-run independently)
stroppy run tpcc --steps load_data

# Step 3: run the benchmark only
stroppy run tpcc --no-steps drop_schema,create_schema,create_procedures,load_data
```

## See Also

- `stroppy help probe` &mdash; Full reference for probe flags and section descriptions
- `stroppy help steps` &mdash; Step definition, filtering, and discovery
- `stroppy help drivers` &mdash; How driver presets and CLI overrides work
