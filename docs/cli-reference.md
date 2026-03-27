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
stroppy run <script> [sql_file] [-d driver] [-D key=value]
            [-e KEY=VALUE] [--steps step1,step2] [-- k6-args...]
```

The first positional argument selects the input mode based on its extension:

| Input | Mode | Example |
|-------|------|---------|
| No extension | Preset | `stroppy run tpcc` |
| `.ts` | Script | `stroppy run bench.ts` |
| `.sql` | SQL file | `stroppy run queries.sql` |
| Quoted string with spaces | Inline SQL | `stroppy run "select 1"` |

The optional second positional argument specifies an explicit SQL file, overriding auto-derivation.

### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--driver NAME` | `-d` | Use a driver preset (`pg`, `mysql`, `pico`). Append a number for additional drivers: `-d1`, `-d2`, etc. Also accepts raw JSON. |
| `--driver-opt K=V` | `-D` | Override a single driver field. Append a number for additional drivers: `-D1`, `-D2`. See [driver option keys](#driver-option-keys) below. |
| `--env KEY=VALUE` | `-e` | Set an environment variable for the script. Lowercase keys are auto-uppercased. Real environment takes precedence over `-e` values. |
| `--steps step1,step2` | | Run only the listed steps; skip all others. |
| `--no-steps step1,step2` | | Skip the listed steps; run everything else. |
| `--` | | Everything after this separator is forwarded to k6. |

`--steps` and `--no-steps` are mutually exclusive. Both accept comma-separated lists or the `=` form (`--steps=create_schema,load`).

### Driver presets

| Preset | driverType | url | defaultInsertMethod |
|--------|-----------|-----|---------------------|
| `pg` | `postgres` | `postgres://postgres@localhost:5432` | `copy_from` |
| `mysql` | `mysql` | `myuser@tcp(localhost:3306)/mydb` | `plain_bulk` |
| `pico` | `picodata` | `postgres://admin@localhost:1331` | `plain_bulk` |

### Driver option keys

| Key | Type | Description |
|-----|------|-------------|
| `url` | string | Database connection URL |
| `driverType` | string | `postgres`, `mysql`, or `picodata` |
| `defaultInsertMethod` | string | `plain_query`, `copy_from`, or `plain_bulk` |
| `defaultTxIsolation` | string | `read_uncommitted`, `read_committed`, `repeatable_read`, `serializable`, `connection_only`, `none` |
| `errorMode` | string | `silent`, `log`, `throw`, `fail`, `abort` |
| `bulkSize` | int | Rows per bulk INSERT (default: 500) |
| `pool.maxConns` | int | Maximum pool connections |
| `pool.minConns` | int | Minimum pool connections |
| `pool.maxConnLifetime` | duration | Max connection lifetime (e.g. `1h`) |
| `pool.maxConnIdleTime` | duration | Max idle connection time (e.g. `10m`) |

### Examples

```bash
# Built-in TPC-C preset
stroppy run tpcc

# Preset with k6 args
stroppy run tpcb -- --duration 5m

# Preset with explicit SQL variant
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
stroppy run tpcc --steps create_schema,load

# Run all steps except specified
stroppy run tpcc --no-steps load

# PostgreSQL driver preset
stroppy run tpcc -d pg

# Preset with URL override
stroppy run tpcc -d pg -D url=postgres://prod:5432

# Two drivers: pg + mysql
stroppy run tpcc -d pg -d1 mysql

# Set POOL_SIZE env for the script
stroppy run tpcc -e pool_size=200

# Multiple env overrides
stroppy run tpcc -e FOO=bar -e BAZ=qux
```

---

## stroppy probe

Run a script in a mocked environment to extract metadata without executing the actual benchmark. Shows configuration, k6 options, SQL structure, steps, environment variables, and driver setup.

```
stroppy probe <script> [sql_file] [flags]
```

### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--output FORMAT` | `-o` | Output format: `human` (default) or `json` |
| `--local` | `-l` | Prevent tmp dir creation; resolve imports from the script's working directory |
| `--config` | | Show only the Stroppy config section |
| `--options` | | Show only the k6 options section |
| `--sql` | | Show only the SQL file structure section |
| `--steps` | | Show only the steps section |
| `--envs` | | Show only the environment variables section |
| `--drivers` | | Show only the drivers section |

When no section flags are set, all sections are shown. Multiple section flags can be combined.

### Examples

```bash
# Probe all sections
stroppy probe workloads/tpcc/tpcc.ts

# Probe with an explicit SQL file
stroppy probe workloads/tpcc/tpcc.ts workloads/tpcc/pg.sql

# Show only SQL structure
stroppy probe workloads/tpcc/tpcc.ts --sql

# Show SQL structure and steps together
stroppy probe workloads/tpcc/tpcc.ts --sql --steps

# Show driver defaults
stroppy probe workloads/tpcc/tpcc.ts --drivers

# Machine-readable JSON output
stroppy probe workloads/tpcc/tpcc.ts -o json

# Probe using local imports (no tmp dir)
stroppy probe workloads/tpcc/tpcc.ts --local
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
| `--workdir <path>` | Yes | Output directory for the development environment |
| `--preset <name>` | No | Include an example preset script |

### Available presets

`simple`, `tpcc`, `tpcb`, `execute_sql`, `tpcds`

The generated directory contains:

- Proto files (`stroppy.pb.js`, `stroppy.pb.ts`)
- Helper files (`helpers.ts`, `parse_sql.ts`)
- `package.json` for TypeScript types
- k6 binary (`stroppy-k6`)
- Stroppy binary
- k6 symlink
- Preset files (if `--preset` specified)

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

Print versions of stroppy and its key dependencies.

```
stroppy version [--json]
```

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output versions as JSON |

### Output

Default output:

```
stroppy  v4.0.0
k6       v1.7.0
pgx      v5.8.0
```

With `--json`:

```json
{
  "stroppy": "v4.0.0",
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
| `drivers` | Driver presets, options, and multi-driver configuration |
| `envs` | Environment variables in stroppy scripts |
| `probe` | Probe output sections, flags, and output formats |
| `resolution` | How stroppy finds and resolves scripts and SQL files |
| `sql` | SQL file format: sections, queries, parameters, and multi-dialect |
| `steps` | Logical benchmark phases: defining, filtering, and discovering steps |

### Examples

```bash
# List all topics
stroppy help

# Read about driver configuration
stroppy help drivers

# Read about file resolution
stroppy help resolution
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
| `--vus N` | Number of virtual users (concurrent goroutines) | `--vus 10` |
| `--duration D` | Test duration | `--duration 5m` |
| `--iterations N` | Total number of script iterations | `--iterations 1000` |
| `--out FORMAT` | Output metrics to a backend | `--out json=results.json` |
| `-e KEY=VALUE` | Set an environment variable for the k6 script | `-e WAREHOUSES=50` |

### Examples

```bash
# 10 VUs for 5 minutes
stroppy run tpcc -- --vus 10 --duration 5m

# Fixed number of iterations
stroppy run simple -- --iterations 100

# Export metrics as JSON
stroppy run tpcc -- --out json=results.json

# Pass env vars through k6
stroppy run tpcc -- -e WAREHOUSES=50 -e DURATION=10m

# Combine stroppy flags and k6 flags
stroppy run tpcc -d pg --steps load -- --vus 4 --duration 2m
```

---

## Environment variables

### Set by Stroppy (passed to the k6 process)

These are set automatically by the `stroppy run` command before launching k6.

| Variable | Description |
|----------|-------------|
| `STROPPY_DRIVER_0`, `STROPPY_DRIVER_1`, ... | JSON-serialized driver configuration for each driver index. Set from `-d`/`-D` flags. If already set in the environment, the CLI value is skipped. |
| `STROPPY_STEPS` | Comma-separated list of steps to run (from `--steps`). |
| `STROPPY_NO_STEPS` | Comma-separated list of steps to skip (from `--no-steps`). |
| `SQL_FILE` | Path to the resolved SQL file. Set when a SQL file is found via auto-derivation or explicit argument. |
| `LOG_LEVEL` | Logger level (`debug`, `info`, `warn`, `error`, `fatal`). Set from Stroppy global config. |
| `LOG_MODE` | Logger mode (`development`, `production`). Set from Stroppy global config. |

### Read by scripts (via ENV() helper)

These are commonly used by built-in workloads. Scripts declare them with the `ENV()` function in TypeScript.

| Variable | Description |
|----------|-------------|
| `STROPPY_ERROR_MODE` | Error handling mode for all drivers: `silent`, `log`, `throw`, `fail`, `abort`. Overrides per-driver config. |
| `SQL_FILE` | Path to SQL file. Auto-set by the runner when an SQL file is resolved. Scripts use this to load their SQL. |
| `STROPPY_STEPS` | Read by the Step filter in `helpers.ts` to determine which steps to run. |
| `STROPPY_NO_STEPS` | Read by the Step filter in `helpers.ts` to determine which steps to skip. |

### k6 environment variables

These are standard k6 environment variables that work with Stroppy.

| Variable | Description |
|----------|-------------|
| `K6_WEB_DASHBOARD` | Set to `true` to enable the real-time web dashboard (default: `http://localhost:5665`). |
| `K6_WEB_DASHBOARD_EXPORT` | Path to export an HTML report at the end of the run (e.g. `report.html`). Requires `K6_WEB_DASHBOARD=true`. |

### Stroppy Cloud (internal)

| Variable | Description |
|----------|-------------|
| `STROPPY_CLOUD_URL` | Cloud service URL for result uploading. |
| `STROPPY_CLOUD_RUN_ID` | Run ULID for cloud integration. Both must be set to enable cloud upload. |

### Precedence

Environment variable precedence from highest to lowest:

1. **Real environment** &mdash; Variables already set in the shell
2. **`-e` flag overrides** &mdash; Values passed via `stroppy run -e KEY=VALUE`
3. **Driver/runner defaults** &mdash; `STROPPY_DRIVER_N`, `SQL_FILE`, `STROPPY_STEPS`, etc.

The `-e` flag auto-uppercases keys: `-e pool_size=200` sets `POOL_SIZE=200`.

---

## File resolution

Scripts and SQL files are resolved through a search path:

1. **Current working directory** &mdash; the path as given
2. **`~/.stroppy/`** &mdash; `~/.stroppy/<path>`
3. **Built-in workloads** &mdash; embedded in the binary (direct path)
4. **Built-in workloads** &mdash; under the preset subdirectory (when a preset name is inferred)

Script and SQL files resolve independently. Explicit relative paths (`./`) and absolute paths (`/`) skip preset-based lookup.

For the full description of input modes, preset inference, and SQL auto-derivation, see [Introduction &mdash; File Resolution](./introduction#file-resolution) and `stroppy help resolution`.
