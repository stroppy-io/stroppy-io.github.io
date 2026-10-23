---
sidebar_position: 8
title: Probe & Parameters
description: Inspect available workloads, effective typed inputs, steps, named databases, and driver capabilities without executing a run
---

# Probe & Parameters

`stroppy probe` inspects the catalog available to the current binary, including
registered custom workloads. It does not execute workload actions, dispatch a
driver, or connect to a database.

```bash
stroppy probe
stroppy probe -o json
stroppy probe tpcc/tx -o json
```

## Catalog discovery

Human output lists embedded asset presets, workload parameter schemas, and
driver insert methods. SQL asset families and executable workloads are separate:
`tpcc` owns the files, while `tpcc/tx` and `tpcc/procs` register behavior.

JSON has three top-level arrays:

```json
{"presets": [], "workloads": [], "drivers": []}
```

Inspect one workload's declarations:

```bash
stroppy probe tpcc/tx -o json | jq '.workloads[0].params'
```

Each parameter reports:

| Field | Meaning |
|---|---|
| `name` | Canonical kebab-case name. |
| `flag` | Direct CLI flag. |
| `scope` | `run` or `workload`. |
| `type` | Declared value type; durations and drain policies may be strings. |
| `description` | Workload-authored help. |
| `default` | Declared default, including contextual defaults. |
| `env` | Projected uppercase process environment name. |
| `aliases` | Alternate declared parameter names. |
| `config` | Lower-camel key under `run` or `params`. |
| `constraints` | Declared limits or allowed values. |

Driver capabilities:

```bash
stroppy probe -o json | jq '.drivers[] | {type, insert_methods}'
```

The catalog includes `crdb`, `yugabyte`, and `tidb` in 6.2. Their wire protocol
does not imply that every workload supports every SQL feature; check the
[workload catalog](./presets).

## Resolve the inputs you intend to run

`--resolved` evaluates the selected definition with explicit inputs, without
running its steps:

```bash
stroppy probe tpcc/tx --resolved -d pg \
  --scale-factor 10 --load-workers 8 \
  --executor constant-vus --vus 16 --duration 60s -o json \
  > resolved.json

jq '.workloads[0] | {values, steps, driver_refs, metrics}' resolved.json
```

The result exposes effective parameter values and sources, declared steps,
named driver references, and metric schemas. A workload may derive its defaults
or available steps from the selected driver. Invalid typed input fails here
rather than connecting to a database and failing later.

This is an input check, not a database readiness or SQL compatibility test.

## Dynamic workload help

Selected-workload help lists the same typed flags:

```bash
stroppy run tpcb/tx --help
stroppy run tpcc/procs --help
stroppy run tpch/tx --help
stroppy run tpcds --help
```

Custom workloads installed with `stroppy build` participate in `probe` and
selected-workload help too. Use [Custom workloads](./custom-workloads) to author
and register them.

## Parameter sources

Precedence, highest first:

1. direct typed CLI flag;
2. process environment;
3. matching config `run` or `params` key;
4. declared default.

These two forms set the same workload values:

```bash
stroppy probe tpcc/tx --resolved --scale-factor 10 --load-workers 8 -o json
SCALE_FACTOR=10 LOAD_WORKERS=8 stroppy probe tpcc/tx --resolved -o json
```

Equivalent workload config:

```json
{
  "script": "tpcc/tx",
  "params": {"scaleFactor": 10, "loadWorkers": 8}
}
```

`-e` and config `env` are removed in 6.2. `DURATION` alone does not select a timed
executor. Use direct flags for interactive runs and typed config for repeatable
automation.

## Common uses

```bash
# Discover installed workloads and their source.
stroppy list

# Save the catalog for tooling.
stroppy probe -o json > stroppy-catalog.json

# Find workloads that declare a load-worker flag.
stroppy probe -o json | jq '
  .workloads[]
  | select(any(.params[]; .flag == "--load-workers"))
  | .name'

# Inspect a selected driver's contextual defaults.
stroppy probe tpcc/tx --resolved -d crdb -o json
```

To check reachability and actual SQL, use a small run against a disposable
database after inspecting the resolved configuration.
