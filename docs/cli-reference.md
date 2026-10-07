---
sidebar_position: 11
title: CLI Reference
description: Commands, flags, inputs, and exit behavior in Stroppy v6
---

# CLI Reference

Stroppy v6 exposes command groups for running benchmarks and for authoring your
own:

```text
stroppy run          stroppy init       stroppy build      stroppy export
stroppy baseline     stroppy eject      stroppy list       stroppy cache
stroppy probe        stroppy remove     stroppy version    stroppy help
```

The authoring commands (`init`, `eject`, `build`, `list`, `remove`, `cache`,
`export`) ship with the next v6 release. See [Custom workloads](./custom-workloads)
for the workflow they support.

Run `stroppy <command> --help` for terminal help. Registered workloads add
their typed flags dynamically:

```bash
stroppy run tpcc/tx --help
```

## `stroppy run`

Run a registered workload, SQL file, or inline SQL:

```text
stroppy run [<workload>] [sql_file] \
  [-f config.json] [-d driver] [-D key=value] [-e KEY=VALUE] \
  [--steps step1,step2] [typed flags]
```

The first positional may come from `script` in a config file. A CLI positional
overrides that field.

### Input modes

| Input | Mode | Example |
|---|---|---|
| Registered name | Go workload | `stroppy run tpcc/tx` |
| `.sql` file | Execute SQL file | `stroppy run ./queries.sql` |
| String containing spaces | Execute inline SQL | `stroppy run "select 1"` |

A registered workload may take an explicit SQL override as its second
positional:

```bash
stroppy run tpcc/tx ./workloads/tpcc/pico.sql -d pico
```

Arguments after `--` are unsupported.

### Shared run flags

| Flag | Type | Default | Description |
|---|---|---|---|
| `--executor` | string | `shared-iterations` | `shared-iterations` or `constant-vus`. |
| `--vus` | integer | `1` | Number of virtual users. |
| `--iterations` | integer | `1` | Total iterations shared across VUs. |
| `--duration` | duration | `0s` | Duration for `constant-vus`; positive value required there. |
| `--query-timeout` | duration | `0s` | Deadline per SQL statement; zero disables it. |

Examples:

```bash
stroppy run tpcb/tx --executor shared-iterations --vus 4 --iterations 100
stroppy run tpcc/tx --executor constant-vus --vus 32 --duration 5m
stroppy run tpch/tx --query-timeout 2m
```

### Workload flags

Each registered workload declares typed parameters such as `--scale-factor`,
`--load-workers`, or `--tx-isolation`. Their types and defaults differ by
workload. Inspect them rather than guessing:

```bash
stroppy run tpcb/tx --help
stroppy run tpcc/procs --help
stroppy run tpch/tx --help
stroppy run tpcds --help
```

`stroppy probe -o json` provides the same schemas for tools.

### Driver flags

| Flag | Meaning |
|---|---|
| `-d NAME`, `--driver NAME` | Select preset or raw JSON for driver 0. |
| `-D key=value`, `--driver-opt key=value` | Override driver 0 field. |
| `-d1`, `-d2`, ... | Select additional indexed drivers. |
| `-D1`, `-D2`, ... | Override fields on indexed drivers. |

Presets: `pg`, `mysql`, `pico`, `ydb`, `noop`. CSV has no short preset.

```bash
stroppy run tpcc/tx -d pg
stroppy run tpcc/tx -d pg -D url=postgres://prod:5432/bench
stroppy run tpcc/tx -d pg -d1 mysql
stroppy run tpcb/tx \
  -D driverType=csv \
  -D url='/tmp/tpcb-csv?merge=true&workload=tpcb' \
  --steps drop_schema,create_schema,load_data
```

See [Drivers & Configuration](./drivers) for fields and capabilities.

### Config and compatibility flags

| Flag | Meaning |
|---|---|
| `-f PATH`, `--file PATH` | Load JSON config. Default is `stroppy-config.json` when present. |
| `-e KEY=VALUE`, `--env KEY=VALUE` | Set a compatibility environment input; keys are uppercased. |
| `--log-level VALUE` | `debug`, `info`, `warn`, `error`, or `fatal`. |
| `--log-mode VALUE` | `development` or `production`. |

Typed direct flags have higher precedence than environment and config values.
See [Configuration Files](./config-file).

### Step filters

| Flag | Meaning |
|---|---|
| `--steps a,b` | Run only named steps. |
| `--no-steps a,b` | Run all steps except named steps. |

The flags are mutually exclusive. Comma-separated and equals forms work:

```bash
stroppy run tpcc/tx --steps=create_schema,load_data
stroppy run tpcc/tx --no-steps workload
```

Unknown step names simply do not match a workload step.

### Signals and exit status

- First SIGINT or SIGTERM cancels the scenario and runs teardown.
- Second signal forces immediate exit.
- Graceful SIGINT exits `130`; graceful SIGTERM exits `143`.
- Forced second signal exits `2`.
- Setup, validation, fatal, teardown, and ordinary command errors exit nonzero.
- Terminal nonfatal transaction/query errors are summarized but exit `0`.

Automation that treats any terminal benchmark error as failure should inspect
`terminal_errors_total` or the `bench completed with errors` summary marker.

## `stroppy baseline`

Measure Stroppy's framework and PostgreSQL wire ceilings without a database:

```text
stroppy baseline [flags]
```

| Flag | Default | Description |
|---|---|---|
| `--quick` | false | Shorter phases and smaller load. |
| `--tiers` | `noop,wire` | Tier list: `noop`, `wire`. |
| `--vus` | GOMAXPROCS | Parallel transaction VUs. |
| `--duration` | `3s` | Transaction phase duration. |
| `--rows` | `250000` | Rows per load phase. |
| `--json` | false | JSON report on stdout. |
| `--no-save` | false | Skip history file. |
| `--server-path` | unset | Explicit pg-noop executable. |
| `--download` | `ask` | `ask`, `always`, or `never`. |

```bash
stroppy baseline
stroppy baseline --quick
stroppy baseline --tiers noop
stroppy baseline --json --no-save
```

See [Machine Baseline](./baseline).

## `stroppy probe`

List compiled-in workload and driver metadata without running a workload or
connecting to a database:

```text
stroppy probe [-o human|json]
```

| Flag | Default | Description |
|---|---|---|
| `-o`, `--output` | `human` | `human` or `json`. |

Probe takes no positional arguments.

```bash
stroppy probe
stroppy probe -o json
```

See [Probe & Parameters](./probe).

## Author tooling

These commands scaffold workloads, register them, and manage the catalog they
live in. See [Custom workloads](./custom-workloads) for a walkthrough.

### `stroppy init`

Create a standalone workload project:

```text
stroppy init PATH [flags]
```

| Flag | Type | Default | Description |
|---|---|---|---|
| `--module` | string | `example.com/<name>` | Go module path for the new project. |
| `--sdk-version` | string | running binary's version | Stroppy release or pseudo-version to require. |
| `--offline` | bool | `false` | Resolve only cached dependencies. |
| `-y`, `--yes` | bool | `false` | Allow a verified private Go download. |

The project is retained when dependency resolution fails, along with the retry
command.

### `stroppy eject`

Restore explicitly published workload source into a new or empty directory:

```text
stroppy eject NAME PATH [flags]
```

| Flag | Type | Default | Description |
|---|---|---|---|
| `--module` | string | `example.com/<name>` | Go module path for the restored project. |
| `--sdk-version` | string | running binary's version | Stroppy release or pseudo-version to require. |
| `--offline` | bool | `false` | Resolve only cached dependencies. |
| `-y`, `--yes` | bool | `false` | Allow a verified private Go download. |

Non-empty and symlink destinations are refused; there is no overwrite option. A
workload that published no source reports a source-unavailable error.

### `stroppy build`

Compile and register a custom workload from its project directory:

```text
stroppy build [path] [flags]
```

| Flag | Type | Default | Description |
|---|---|---|---|
| `--replace` | bool | `false` | Replace an existing catalog entry of the same name. |
| `--refresh` | bool | `false` | Rebuild the local runtime from catalog snapshots, taking no path. |
| `--source-root` | string | empty | SDK source tree to compile against instead of the pinned module. |
| `--offline` | bool | `false` | Use only cached tools and modules. |
| `-y`, `--yes` | bool | `false` | Allow a verified private Go download. |

`path` defaults to the working directory, and `build` checks that directory for
an importable package before its conventional `workload/` child. Every build
reports the SDK the activated runtime embeds, and `--source-root` must name the
Stroppy SDK module — a workload project is rejected by name.

### `stroppy list`

```text
stroppy list [-o human|json]
```

Lists built-in and custom workloads with their origin.

### `stroppy remove`

```text
stroppy remove NAME [flags]
```

Unregisters a custom workload and rebuilds the runtime without it. Built-in
workloads cannot be removed. Accepts `--source-root`, `--offline`, and `-y` as
`build` does.

### `stroppy cache`

```text
stroppy cache inspect DIGEST [-o human|json]
stroppy cache clean
```

`inspect` resolves a full or unique digest prefix and reports non-secret build
provenance: platform, Go version, embedded workloads, and the SDK origin
(`sdk=module …` or `sdk=source tree …`). `clean` removes reusable artifacts and
private Go caches; the active runtime state is preserved.

### `stroppy export`

Build one portable binary containing built-ins and the selected custom
workloads:

```text
stroppy export <workload ...> -o PATH [flags]
stroppy export --all -o PATH [flags]
```

| Flag | Type | Default | Description |
|---|---|---|---|
| `--all` | bool | `false` | Include every custom catalog workload. |
| `-o`, `--output` | string | required | Portable binary output path. |
| `--source-root` | string | empty | SDK source tree to compile against. |
| `--offline` | bool | `false` | Use only cached tools and modules. |
| `-y`, `--yes` | bool | `false` | Allow a verified private Go download. |

`--all` and an explicit workload list are mutually exclusive. `GOOS`/`GOARCH`
select the target for cross-compilation.

## `stroppy version`

```text
stroppy version [--json]
```

Text output:

```text
stroppy  v6.0.0
pgx      v5.10.0
```

JSON output:

```json
{
  "pgx": "v5.10.0",
  "stroppy": "v6.0.0"
}
```

## `stroppy help`

List extended reference topics:

```bash
stroppy help
stroppy help drivers
stroppy help config-file
stroppy help datagen
stroppy help envs
stroppy help probe
stroppy help resolution
stroppy help sql
stroppy help steps
stroppy help baseline
```

These topics are compiled into the binary and match its release.

## Environment compatibility

Every typed parameter projects to an uppercase environment name. Some preserve
legacy aliases. Source precedence is:

1. typed CLI flag;
2. process environment;
3. `-e` compatibility override;
4. matching typed `run` or `params` config value;
5. config `env` map;
6. declared default.

Common names:

| Environment | Typed flag |
|---|---|
| `EXECUTOR` | `--executor` |
| `VUS` | `--vus` |
| `ITERATIONS` (`ITER`) | `--iterations` |
| `DURATION` | `--duration` |
| `QUERY_TIMEOUT` | `--query-timeout` |
| `SCALE_FACTOR` | `--scale-factor` |
| `LOAD_WORKERS` | `--load-workers` |
| `TX_ISOLATION` | `--tx-isolation` |

Use `stroppy probe -o json` for each workload's complete mapping.

## SQL resolution

SQL files resolve in this order:

1. current directory;
2. `~/.stroppy/`;
3. embedded assets.

An explicit local `.sql` path bypasses embedded content. A short workload SQL
name uses the embedded snapshot and requires rebuilding Stroppy after source
asset changes.
