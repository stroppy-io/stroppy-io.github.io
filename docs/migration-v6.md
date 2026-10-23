---
sidebar_position: 2
title: Migrating to v6
description: Migration from Stroppy v5 and 6.1.x to the 6.2 CLI and workload SDK
---

# Migrating to v6

Stroppy v6 replaces the embedded k6/JavaScript runtime with a native Go
benchmark engine. The result is one smaller operational surface: one binary,
registered Go workloads, typed parameters, native metrics, and no generated
workspace.

This is a major-version migration. Existing v5 documentation remains available
from the version selector.

## Upgrading from 6.1.x

6.2.0 includes source and configuration incompatibilities within the v6 series:

- Import the SDK as `github.com/stroppy-io/stroppy/v6` and use Go 1.27 or newer.
- Replace the `bench.Workload` lifecycle with `bench.Test` and immediate `d.Execution.Step` calls. Existing custom Go workloads need source migration; see [Custom workloads](./custom-workloads) and [Extensibility](./extensibility).
- Replace `-e key=value` and config `env` with typed flags, process environment, or `run`/`params` config fields.
- Rename driver key `"0"` to `"default"`. Replace additional numeric keys/flags with names declared by the workload, such as `primary` and `-dprimary` / `-Dprimary`.
- Select timed execution explicitly with `--executor constant-vus`. `DURATION` alone no longer infers the executor; `--drain-timeout` bounds completion of in-flight actions.
- Reports use envelope schema 4. Keep older JSON for inspection; custom report consumers must check the schema rather than assume all versions have identical structure.

The sections below cover migration from v5 to the current release.

## Removed runtime surfaces

V6 does not include:

- TypeScript or JavaScript workload execution;
- k6, sobek, xk6, Node.js, or npm runtime dependencies;
- `stroppy gen` workspace scaffolding;
- the separate `build/k6` binary or `k6 x stroppy` command;
- arguments after `--` or k6 CLI passthrough;
- `k6Args` and `k6Config` config fields;
- the `Rel`/`Attr`/`Draw` expression framework and protobuf `InsertSpec` path;
- the driver `errorMode` and `defaultTxIsolation` fields;
- the removed cloud-status service.

V5 scripts remain source material, but v6 cannot execute them. Keep v5 installed
for those scripts or port the workload to Go and compile it into Stroppy.

## Workload migration

Built-in names remain concise:

| Purpose | V6 workload |
|---|---|
| TPC-B transactions | `tpcb/tx` |
| TPC-B stored procedures | `tpcb/procs` |
| TPC-C transactions | `tpcc/tx` |
| TPC-C stored procedures | `tpcc/procs` |
| TPC-H | `tpch/tx` |
| TPC-DS | `tpcds` |
| Small smoke workload | `simple` |
| SQL file or inline SQL | `execute_sql` (selected automatically) |

Custom SQL still works without rebuilding:

```bash
stroppy run ./queries.sql -d pg
stroppy run "select count(*) from orders" -d pg
stroppy run tpcc/tx ./custom-tpcc.sql -d pg
```

Custom executable workloads now publish a `bench.Test` descriptor, register with
`bench.Register`, and run standalone or through `stroppy build`. See [Extensibility](./extensibility).

## Scenario migration

Use typed run flags instead of k6 flags or environment-only scenario setup:

```bash
# v6 throughput run
stroppy run tpcc/tx \
  --executor constant-vus --vus 10 --duration 60s

# v6 fixed-work run
stroppy run tpcb/tx \
  --executor shared-iterations --vus 4 --iterations 100
```

Compatibility environment names remain accepted:

| V6 flag | Environment | Legacy alias |
|---|---|---|
| `--executor` | `EXECUTOR` | — |
| `--vus` | `VUS` | — |
| `--iterations` | `ITERATIONS` | — |
| `--duration` | `DURATION` | — |
| `--query-timeout` | `QUERY_TIMEOUT` | — |

`DURATION` without an explicit executor does not infer `constant-vus`. Select the executor explicitly.

`MAX_DURATION` is gone. Shared iterations run until completion or cancellation.

## Workload parameter migration

Registered workloads expose their own typed flags:

```bash
stroppy run tpcc/tx --help
stroppy run tpcc/tx --scale-factor 10 --load-workers 8 --pacing=false
```

Process environment remains a lower-precedence input. `-e` was removed:

```bash
SCALE_FACTOR=10 stroppy run tpcc/tx
stroppy run tpcc/tx --scale-factor 10
```

Prefer direct flags or typed config fields. `probe -o json` exposes every
parameter's flag, type, default, environment name, legacy aliases, and config
key.

## Config-file migration

V6 keeps the top-level file envelope but adds typed `run` and `params` objects:

```json
{
  "version": "1",
  "script": "tpcc/tx",
  "drivers": {
    "default": {
      "driverType": "postgres",
      "url": "postgres://db:5432/bench",
      "pool": {"maxConns": 100, "minConns": 20}
    }
  },
  "run": {
    "executor": "constant-vus",
    "vus": 10,
    "duration": "60s",
    "queryTimeout": "5s"
  },
  "params": {
    "scaleFactor": 10,
    "loadWorkers": 8,
    "pacing": false
  }
}
```

Delete these removed fields before loading a v5 config:

```text
k6Args
k6Config
env
drivers.*.errorMode
drivers.*.defaultTxIsolation
```

Move transaction isolation to the selected workload's `txIsolation` parameter
or `--tx-isolation` flag.

`global.seed` now requires a bare unsigned JSON integer, not a quoted number.
Lower-camel field names and established v5 snake_case aliases remain compatible,
but duplicate, colliding, mis-cased, and unknown fields are rejected
recursively.

See [Configuration Files](./config-file) for the complete envelope.

## Data-load migration

V6 workloads stream `gen.BatchSource` values through `driver.InsertRequest` and
`Bench.Insert`. Reusable primitives live in `pkg/gen`; canonical TPC-H and
TPC-DS adapters live in `workloads/tpch/tpchgen` and `workloads/tpcds/tpcdsgen`.

Driver insert method strings remain:

```text
plain_query
plain_bulk
columnar
native
```

`defaultInsertMethod` is now only a fallback when the workload leaves a request
method unset. A method selected by the workload wins.

PostgreSQL `UNLOGGED` loading is opt-in in v6:

```bash
stroppy run tpcc/tx -d pg --pg-unlogged=true
```

## Error and exit migration

Error policy now belongs to workloads, based on facts classified by each
driver. Transactional workloads retry serialization conflicts, deadlocks, lock
timeouts, and unconditional transient facts by default.

A terminal nonfatal transaction or query-set error:

- fails one iteration or query;
- lets remaining virtual users or queries continue;
- appears in bounded warnings and final error metrics;
- leaves process exit status at `0`.

The final output prominently says `bench completed with errors`. Gate automation
on that marker or terminal-error metrics when nonfatal errors must fail a job.

Setup, validation, workload teardown, driver teardown, fatal, and ordinary
command errors remain nonzero. Graceful SIGINT/SIGTERM exits `130`/`143`; a
second signal forces exit `2`.

## Metrics and reporting migration

V6 uses OpenTelemetry counters, gauges, and fixed-bucket histograms internally.
The terminal summary prints totals and approximate p50/p90/p95/p99 values.
Optional OTLP gRPC or HTTP export is configured under
`global.exporter.otlpExport`.

Removed k6 web-dashboard, HTML-export, threshold, and `--out` workflows do not
have direct compatibility shims. Use:

- the native terminal summary;
- OTLP plus the shipped Grafana dashboard;
- workload-specific reports such as TPC-C compliance output;
- saved JSON/HTML reports, optional metric/log capture, and local comparison via `stroppy reports`;
- `stroppy baseline` JSON history for Stroppy overhead comparisons.

See [Reports & Workflow](./reports-workflow).

## Validate a migrated setup

```bash
stroppy version
stroppy probe
stroppy run tpcc/tx --help
stroppy run tpcc/tx -f stroppy-config.json --steps create_schema,load_data
```

`probe` can inspect the whole catalog or a selected workload. Use `stroppy probe tpcc/tx --resolved -d pg -o json` to validate effective inputs without executing setup or connecting to a database.
