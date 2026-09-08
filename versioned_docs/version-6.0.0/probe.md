---
sidebar_position: 8
title: Probe & Parameters
description: Discover compiled workloads, typed parameters, embedded assets, and driver capabilities
---

# Probe & Parameters

`stroppy probe` reports metadata compiled into the v6 binary. It does not set up
a workload, dispatch a driver, or connect to a database.

```bash
stroppy probe
stroppy probe -o json
```

Probe takes no positional arguments.

## Human output

Output has three sections:

- **PRESETS** — embedded SQL and README assets grouped by preset;
- **WORKLOADS** — registered workload parameter schemas;
- **DRIVERS** — supported insert methods by driver type.

Representative shape:

```text
PRESETS

  tpcb   sql: mysql, pg, pico, ydb
  tpcc   sql: mysql, pg, pico, ydb, ydb_no_indexes
  tpch   sql: mysql, pg, pico, ydb
  tpcds  sql: mysql, pg, pico, ydb, schema.*

WORKLOADS

  tpcc/tx
    run:      --executor --vus --iterations --duration --query-timeout
    workload: --scale-factor --warehouse-start --load-items --load-workers
              --pacing --pg-unlogged --retry-attempts --sql-file
              --tx-isolation

DRIVERS

  postgres  plain_query, plain_bulk, columnar, native
  mysql     plain_query, plain_bulk, native
  picodata  plain_query, plain_bulk, native
  ydb       plain_query, plain_bulk, columnar, native
  noop      plain_query, plain_bulk, columnar, native
  csv       native
```

Exact formatting and defaults come from the installed binary.

## JSON output

```bash
stroppy probe -o json > catalog.json
```

Top-level arrays:

```json
{
  "presets": [],
  "workloads": [],
  "drivers": []
}
```

Each workload contains a sorted `params` array. Each parameter reports:

| Field | Meaning |
|---|---|
| `name` | Canonical kebab-case parameter name. |
| `flag` | Direct CLI flag. |
| `scope` | `run` or `workload`. |
| `type` | String, bool, integer, float, or duration type. |
| `description` | Workload-authored help text. |
| `default` | Declared default; contextual defaults may be null. |
| `env` | Uppercase environment name. |
| `legacy_aliases` | Preserved compatibility names. |
| `config` | Lower-camel key in `run` or `params`. |

Example extraction:

```bash
stroppy probe -o json \
  | jq '.workloads[] | select(.name == "tpcc/tx") | .params'
```

Driver capabilities:

```bash
stroppy probe -o json \
  | jq '.drivers[] | {type, insert_methods}'
```

## Dynamic workload help

Probe is broad catalog discovery. Use selected-workload help for descriptions,
defaults, and accepted syntax:

```bash
stroppy run tpcb/tx --help
stroppy run tpcc/procs --help
stroppy run tpch/tx --help
stroppy run tpcds --help
```

The command binds the selected workload's schema without connecting to a
database.

## Parameter sources

Every declared parameter can be supplied through:

1. direct typed CLI flag;
2. process environment;
3. `-e` compatibility override;
4. matching config `run` or `params` key;
5. config `env` compatibility map;
6. default.

Example schema and equivalent values:

```bash
stroppy run tpcc/tx --scale-factor 10 --load-workers 8
SCALE_FACTOR=10 LOAD_WORKERS=8 stroppy run tpcc/tx
stroppy run tpcc/tx -e scale_factor=10 -e load_workers=8
```

```json
{
  "script": "tpcc/tx",
  "params": {
    "scaleFactor": 10,
    "loadWorkers": 8
  }
}
```

Direct flags are preferred for interactive runs; typed config is preferred for
repeatable automation.

## Embedded assets versus registered workloads

These are separate catalogs:

- asset presets tell the binary where embedded SQL/docs live;
- workload registration provides executable Go behavior and typed parameters.

A package that owns assets registers its embedded filesystem with
`workloads.Register`. Executable workload factories register with
`bench.Register`. `probe` joins both views for discovery.

This distinction explains why SQL assets are listed by preset while workload
names include variants such as `tpcb/tx` and `tpcb/procs`.

## Common uses

```bash
# Confirm installed binary contains expected v6 workloads.
stroppy probe

# Generate machine-readable UI or automation metadata.
stroppy probe -o json > stroppy-catalog.json

# Find every workload supporting --load-workers.
stroppy probe -o json | jq '
  .workloads[]
  | select(any(.params[]; .flag == "--load-workers"))
  | .name'

# Inspect one workload before writing config.
stroppy run tpcds --help
```

Probe does not validate database reachability or SQL execution. Use a small
workload or selected setup steps for runtime validation.
