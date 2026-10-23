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
stroppy probe        stroppy reports    stroppy remove     stroppy version    stroppy help
```

The authoring commands (`init`, `eject`, `build`, `list`, `remove`, `cache`,
`export`) are available in 6.2.0. See [Custom workloads](./custom-workloads)
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
  [-f config.json] [-d driver] [-D key=value] \
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
| `--duration` | duration | `1m` | Duration for `constant-vus`; positive value required there. |
| `--drain-timeout` | string | `30s` | Grace for in-flight timed work; `none` waits without a timeout. |
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
| `-d NAME`, `--driver NAME` | Select preset or raw JSON for the default database. |
| `-D key=value`, `--driver-opt key=value` | Override a field on the default database. |
| `-dprimary`, `-dsecondary`, ... | Configure a named database declared by the workload. |
| `-Dprimary key=value` | Override a field on a named database. |

Presets: `pg`, `mysql`, `crdb`, `yugabyte`, `tidb`, `pico`, `ydb`, `noop`. CSV has no short preset.

```bash
stroppy run tpcc/tx -d pg
stroppy run tpcc/tx -d pg -D url=postgres://prod:5432/bench
stroppy run tpcb/tx \
  -D driverType=csv \
  -D url='/tmp/tpcb-csv?merge=true&workload=tpcb' \
  --steps drop_schema,create_schema,load_data
```

See [Drivers & Configuration](./drivers) for fields and capabilities.

### Config and logging flags

| Flag | Meaning |
|---|---|
| `-f PATH`, `--file PATH` | Load JSON config. Default is `stroppy-config.json` when present. |
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

Unknown step names simply do not match a workload step. Use `stroppy probe WORKLOAD --resolved -o json` to inspect declared steps before running.

### Signals and exit status

- First SIGINT or SIGTERM cancels the scenario and runs teardown.
- Second signal forces immediate exit.
- Graceful SIGINT exits `130`; graceful SIGTERM exits `143`.
- Forced second signal exits `2`.
- Setup, validation, fatal, teardown, and ordinary command errors exit nonzero.
- Terminal nonfatal transaction/query errors are summarized but exit `0`.

Automation that treats any terminal benchmark error as failure should inspect
`terminal_errors_total` or the `bench completed with errors` summary marker.

## Run report and capture flags

| Flag | Purpose |
|---|---|
| `--report-format json` | Write final JSON to stdout; diagnostics remain on stderr. |
| `--report-file PATH` | Write final JSON to a file. |
| `--report-html PATH` | Write self-contained HTML with static chart fallbacks. |
| `--no-save-report` | Disable automatic history saving, retaining requested output. |
| `--no-report` | Disable report construction and output; incompatible with capture. |
| `--capture-metrics` | Record timestamped cumulative metrics and gauges. |
| `--capture-logs` | Record structured logs at the effective log level. |
| `--capture-interval D` | Metric sampling interval; default `1s`. |
| `--capture-dir PATH` | Persistent capture root, with a UUID directory per run. |
| `--capture-max-bytes N` | Per-stream byte budget; default `67108864` (64 MiB). |

## `stroppy reports`

```text
stroppy reports list [filters] [-o human|json]
stroppy reports get ID
stroppy reports remove ID...
stroppy reports prune --older-than 720h [filters]
stroppy reports status [-o human|json]
stroppy reports serve --listen 127.0.0.1:8080
stroppy reports export ID --file report.html
stroppy reports artifact ID logs.jsonl
stroppy reports bundle ID --file report.zip
stroppy reports compare ID1 ID2 [--reference ID] [-o human|json|html]
```

History IDs come from `reports list`, not the run UUID inside JSON. Removal and
pruning preview their selection unless confirmed with `--yes`. Full command
examples, filter syntax, and capture limits are in [Run reports](./run-reports).

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
stroppy probe [WORKLOAD] [--resolved] [run inputs] [-o human|json]
```

| Flag | Default | Description |
|---|---|---|
| `-o`, `--output` | `human` | `human` or `json`. |

`WORKLOAD` selects one schema. `--resolved` also shows effective inputs, their sources, declared steps, named drivers, and metric schemas without executing actions.

```bash
stroppy probe
stroppy probe -o json
stroppy probe tpcc/tx --resolved -d pg --scale-factor 10 -o json
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
stroppy  v6.2.0
pgx      v5.10.0
```

JSON output:

```json
{
  "pgx": "v5.10.0",
  "stroppy": "v6.2.0"
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

## Process environment

Every typed parameter projects to an uppercase environment name. Some preserve
legacy aliases. Source precedence is:

1. typed CLI flag;
2. process environment;
3. matching typed `run` or `params` config value;
4. declared default.

`-e` and config `env` are removed. `DURATION` does not select an executor; set `EXECUTOR=constant-vus` or use the explicit flag.

Common names:

| Environment | Typed flag |
|---|---|
| `EXECUTOR` | `--executor` |
| `VUS` | `--vus` |
| `ITERATIONS` | `--iterations` |
| `DURATION` | `--duration` |
| `DRAIN_TIMEOUT` | `--drain-timeout` |
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
