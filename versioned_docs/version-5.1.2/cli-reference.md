---
sidebar_position: 8
title: CLI Reference
description: Complete reference for all stroppy commands, flags, and environment variables
---

# CLI Reference

Complete reference for the `stroppy` command-line interface.

## stroppy run

Run a benchmark script with k6.

```
stroppy run [script] [sql_file] [-d driver] [-D key=value]
            [-e KEY=VALUE] [-f config.json]
            [--steps step1,step2] [-- k6-args...]
```

The `script` argument is optional when a config file supplies `script`. When present, it selects the input mode and overrides the config file `script` field.

| Input | Mode | Example |
|-------|------|---------|
| No extension | Preset/script name | `stroppy run tpcc/tx` |
| `.ts` | Script path | `stroppy run bench.ts` |
| `.sql` | SQL file mode | `stroppy run queries.sql` |
| Quoted string with spaces | Inline SQL | `stroppy run "select 1"` |

The optional second positional argument specifies an explicit SQL file and overrides script-level SQL auto-selection.

### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--driver NAME` | `-d` | Use a driver preset (`pg`, `mysql`, `pico`, `ydb`, `noop`). Append a number for additional drivers: `-d1`, `-d2`, etc. Also accepts raw JSON. |
| `--driver-opt K=V` | `-D` | Override a single driver field. Append a number for additional drivers: `-D1`, `-D2`. See [driver option keys](#driver-option-keys). |
| `--env KEY=VALUE` | `-e` | Set an environment variable for the script. Lowercase keys are auto-uppercased. Real environment takes precedence over `-e` values. |
| `--file PATH` | `-f` | Load run settings from a JSON config file. If omitted, `./stroppy-config.json` is used when present. See [Configuration Files](./config-file). |
| `--steps step1,step2` | | Run only the listed steps; skip all others. |
| `--no-steps step1,step2` | | Skip the listed steps; run everything else. |
| `--` | | Everything after this separator is forwarded to k6. |

`--steps` and `--no-steps` are mutually exclusive. Both accept comma-separated lists or the `=` form (`--steps=create_schema,load_data`).

### Driver presets

| Preset | `driverType` | URL | `defaultInsertMethod` |
|--------|--------------|-----|-----------------------|
| `pg` | `postgres` | `postgres://postgres:postgres@localhost:5432` | `native` |
| `mysql` | `mysql` | `myuser:mypassword@tcp(localhost:3306)/mydb?charset=utf8mb4&parseTime=True&loc=Local` | `plain_bulk` |
| `pico` | `picodata` | `postgres://admin:T0psecret@localhost:1331` | `plain_bulk` |
| `ydb` | `ydb` | `grpc://localhost:2136/local` | `native` |
| `noop` | `noop` | `noop://localhost` | `plain_bulk` |

CSV is a driver type but has no short preset. Configure it with `-D driverType=csv` and a filesystem URL.

### Driver option keys

| Key | Type | Description |
|-----|------|-------------|
| `url` | string | Database connection URL or DSN. |
| `driverType` | string | `postgres`, `mysql`, `picodata`, `ydb`, `noop`, or `csv`. |
| `defaultInsertMethod` | string | `plain_query`, `native`, or `plain_bulk`. |
| `defaultTxIsolation` | string | `read_uncommitted`, `read_committed`, `repeatable_read`, `serializable`, `db_default`, `conn`, or `none`. |
| `errorMode` | string | `silent`, `log`, `throw`, `fail`, or `abort`. |
| `bulkSize` | int | Rows per bulk INSERT or native batch where applicable. Default: `2500`. |
| `pool.maxConns` | int | Maximum pool connections. |
| `pool.minConns` | int | Minimum pool connections. |
| `pool.maxConnLifetime` | duration | Max connection lifetime, e.g. `1h`. |
| `pool.maxConnIdleTime` | duration | Max idle connection time, e.g. `10m`. |
| `caCertFile` | string | CA certificate PEM path for TLS. |
| `authToken` | string | Token credential, mainly for YDB. |
| `authUser` / `authPassword` | string | Static credentials. |
| `tlsInsecureSkipVerify` | bool | Disable TLS certificate verification for testing. |

### Examples

```bash
# Built-in TPC-C preset
stroppy run tpcc/tx

# TPC-B with k6 args
stroppy run tpcb/tx -- --duration 5m

# TPC-DS with explicit SQL variant
stroppy run tpcds tpcds-scale-100

# Custom test script
stroppy run my_benchmark.ts

# Explicit paths
stroppy run ./benchmarks/custom.ts data.sql

# Execute a SQL file directly
stroppy run queries.sql

# Execute inline SQL
stroppy run "select 1"

# Only run specified steps
stroppy run tpcc/tx --steps create_schema,load_data

# Run all steps except specified
stroppy run tpcc/tx --no-steps load_data

# PostgreSQL driver preset
stroppy run tpcc/tx -d pg

# Preset with URL override
stroppy run tpcc/tx -d pg -D url=postgres://prod:5432

# Two drivers: pg + mysql
stroppy run tpcc/procs -d pg -d1 mysql

# Set POOL_SIZE env for the script
stroppy run tpcc/tx -e pool_size=200

# Use a JSON config file
stroppy run -f prod.json
```

---

## stroppy probe

Run a script in a mocked environment to extract metadata without executing the benchmark. Probe shows configuration, k6 options, SQL structure, steps, environment variables, and effective driver setup.

```
stroppy probe [script] [sql_file] [flags]
```

The script argument is optional when a loaded config file supplies `script`.

### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--file PATH` | `-f` | Load the same JSON config file used by `stroppy run`. If omitted, `./stroppy-config.json` is used when present. |
| `--output FORMAT` | `-o` | Output format: `human` (default) or `json`. |
| `--local` | `-l` | Prevent tmp dir creation; resolve imports from the script's working directory. |
| `--config` | | Show only the Stroppy config section. |
| `--options` | | Show only the k6 options section. |
| `--sql` | | Show only the SQL file structure section. |
| `--steps` | | Show only the steps section. |
| `--envs` | | Show only the environment variables section. |
| `--drivers` | | Show only the drivers section. |

When no section flags are set, all sections are shown. Multiple section flags can be combined.

### Examples

```bash
# Probe all sections
stroppy probe tpcc/tx

# Probe with an explicit SQL file
stroppy probe workloads/tpcc/tx.ts workloads/tpcc/pg.sql

# Show only SQL structure
stroppy probe workloads/tpcc/procs.ts --sql

# Show SQL structure and steps together
stroppy probe workloads/tpcc/procs.ts --sql --steps

# Show effective driver setup
stroppy probe tpcc/tx --drivers

# Machine-readable JSON output
stroppy probe workloads/tpcc/procs.ts -o json

# Probe a config file before running it
stroppy probe -f prod.json --config --envs --drivers --steps

# Probe using local imports
stroppy probe workloads/tpcc/procs.ts --local
```

---

## stroppy gen

Generate a development environment with TypeScript support, static files, and an optional preset example.

```
stroppy gen --workdir <path> [--preset <name>]
```

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--workdir <path>` | Yes | Output directory for the development environment. |
| `--preset <name>` | No | Include an example preset script. |

### Available presets

`simple`, `tpcc`, `tpcb`, `execute_sql`, `tpcds`, `tpch`

The generated directory contains:

- Proto files (`stroppy.pb.js`, `stroppy.pb.ts`, `stroppy.d.ts`)
- Helper files (`helpers.ts`, `datagen.ts`, `parse_sql.ts`, `parse_sql.js`)
- `package.json` and `tsconfig.json` for TypeScript types
- Stroppy binary (`stroppy`)
- k6 symlink (`k6` -> `stroppy`)
- Preset files, if `--preset` is specified

### Examples

```bash
# Generate a bare workspace
stroppy gen --workdir ./my-benchmark

# Generate with a preset example
stroppy gen --workdir ./my-benchmark --preset tpcc

# Generate with execute_sql preset
stroppy gen --workdir ./my-benchmark --preset execute_sql
```

---

## stroppy version

Print versions of Stroppy and key dependencies.

```
stroppy version [--json]
```

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output versions as JSON. |

### Output

Default output:

```
stroppy  v5.1.2
k6       v1.7.0
pgx      v5.8.0
```

With `--json`:

```json
{
  "stroppy": "v5.1.2",
  "k6": "v1.7.0",
  "pgx": "v5.8.0"
}
```

---

## stroppy help

Show extended help about a topic. Run without arguments to list all available topics.

```
stroppy help [topic]
```

### Available topics

| Topic | Description |
|-------|-------------|
| `config-file` | JSON configuration files for run and probe settings. |
| `datagen` | Relational data generation with `Rel.table` and InsertSpec. |
| `drivers` | Driver presets, options, and multi-driver configuration. |
| `envs` | Environment variables in Stroppy scripts. |
| `probe` | Probe output sections, flags, and output formats. |
| `resolution` | How Stroppy finds and resolves scripts and SQL files. |
| `sql` | SQL file format: sections, queries, parameters, and multi-dialect. |
| `steps` | Logical benchmark phases: defining, filtering, and discovering steps. |

### Examples

```bash
# List all topics
stroppy help

# Read about driver configuration
stroppy help drivers

# Read about relational data generation
stroppy help datagen
```

---

## k6 passthrough

Everything after the `--` separator in `stroppy run` is forwarded directly to the underlying k6 engine.

```
stroppy run <script> [stroppy-flags] -- [k6-args...]
```

### Common k6 flags

| Flag | Description | Example |
|------|-------------|---------|
| `--vus N` | Number of virtual users. | `--vus 10` |
| `--duration D` | Test duration. | `--duration 5m` |
| `--iterations N` | Total script iterations. | `--iterations 1000` |
| `--out FORMAT` | Output metrics to a backend. | `--out json=results.json` |
| `-e KEY=VALUE` | Set a k6 environment variable. Prefer Stroppy's `-e` before `--` for workload params. | `-e WAREHOUSES=50` |

### Examples

```bash
# 10 VUs for 5 minutes
stroppy run tpcc/tx -- --vus 10 --duration 5m

# Fixed number of iterations
stroppy run tpcb/tx -- --iterations 100

# Export metrics as JSON
stroppy run tpcc/tx -- --out json=results.json

# Combine Stroppy flags and k6 flags
stroppy run tpcc/tx -d pg --steps load_data -- --vus 4 --duration 2m
```

---

## Environment variables

### Set by Stroppy

These are set automatically by `stroppy run` before launching k6.

| Variable | Description |
|----------|-------------|
| `STROPPY_DRIVER_0`, `STROPPY_DRIVER_1`, ... | JSON-serialized driver configuration for each driver index. Set from config files or `-d`/`-D` flags. If already set in the real environment, the composed value is skipped. |
| `STROPPY_STEPS` | Comma-separated list of steps to run. |
| `STROPPY_NO_STEPS` | Comma-separated list of steps to skip. |
| `SQL_FILE` | Path to the resolved SQL file when a SQL file is supplied or auto-resolved. |
| `LOG_LEVEL` | Logger level from Stroppy global config. |
| `LOG_MODE` | Logger mode from Stroppy global config. |

### Read by scripts

These are commonly used by built-in workloads.

| Variable | Description |
|----------|-------------|
| `STROPPY_ERROR_MODE` | Error handling mode for all drivers: `silent`, `log`, `throw`, `fail`, `abort`. Overrides per-driver config. |
| `SQL_FILE` | SQL file path. Current multi-dialect scripts also auto-select SQL based on `driverType` when this is unset. |
| `STROPPY_STEPS` | Read by the Step filter in `helpers.ts`. |
| `STROPPY_NO_STEPS` | Read by the Step filter in `helpers.ts`. |

### k6 environment variables

| Variable | Description |
|----------|-------------|
| `K6_WEB_DASHBOARD` | Set to `true` to enable the real-time web dashboard. |
| `K6_WEB_DASHBOARD_EXPORT` | Path to export an HTML report at the end of the run. Requires `K6_WEB_DASHBOARD=true`. |

### Precedence

Environment and driver precedence from highest to lowest:

1. Real environment variables.
2. `-e KEY=VALUE` CLI env overrides.
3. Config file `env` map.
4. `-d` and `-D` CLI driver presets and overrides.
5. Config file `drivers` map.
6. Script defaults from `ENV()` and `declareDriverSetup()`.

The `-e` flag and config file `env` keys are auto-uppercased: `pool_size=200` sets `POOL_SIZE=200`.

---

## File resolution

Scripts and SQL files are resolved through a search path:

1. Current working directory.
2. `~/.stroppy/`.
3. Embedded built-in workloads.
4. Embedded preset subdirectories when a preset name is inferred.

Script and SQL files resolve independently. Explicit relative paths (`./`) and absolute paths (`/`) skip preset-based lookup.

Current multi-dialect built-ins usually choose their SQL file inside TypeScript based on the active `driverType` (`pg.sql`, `mysql.sql`, `pico.sql`, or `ydb.sql`). A second positional SQL argument or `SQL_FILE` override takes priority.

For the full lookup rules, see [Introduction: File Resolution](./introduction#file-resolution) and `stroppy help resolution`.
