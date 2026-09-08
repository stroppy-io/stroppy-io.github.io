---
slug: stroppy-v6-release
title: "Stroppy v6.0.0: One Go Binary, Typed Workloads, and Native Metrics"
authors: [stroppy-authors]
tags: [release, go, cli, workloads, metrics]
---

We released Stroppy v6.0.0. This is the largest change we have made to the
project so far: Stroppy is now a single Go binary with its own workload engine,
typed parameters, native metrics, and Go implementations of every built-in
workload.

{/* truncate */}

## One binary, one runtime

Previous releases ran TypeScript workloads through an embedded k6 runtime. In
v6 we removed k6, TypeScript, sobek, xk6, Node.js, generated application
protobufs, and the `stroppy gen` workflow. The release archive now contains one
binary:

```bash
stroppy version
```

```text
stroppy  v6.0.0
pgx      v5.10.0
```

We kept SQL files and inline SQL as direct inputs, so small experiments still do
not require a source build:

```bash
stroppy run ./queries.sql -d pg
stroppy run "select 1" -d pg
```

Built-in workloads are registered Go packages:

```bash
stroppy run tpcb/tx
stroppy run tpcb/procs
stroppy run tpcc/tx
stroppy run tpcc/procs
stroppy run tpch/tx
stroppy run tpcds
```

## Typed run and workload parameters

We replaced scenario configuration hidden inside workload scripts with typed
parameters resolved by the Go engine. A throughput run now reads directly:

```bash
stroppy run tpcc/tx -d pg \
  --scale-factor 10 \
  --executor constant-vus \
  --vus 32 \
  --duration 5m
```

A fixed-work run uses the other executor:

```bash
stroppy run tpcb/tx -d pg \
  --executor shared-iterations \
  --vus 4 \
  --iterations 100
```

Each workload declares its own flags and types. We can inspect them from the
binary:

```bash
stroppy run tpcc/tx --help
stroppy probe -o json
```

The JSON config format now has typed `run` and `params` objects:

```json
{
  "script": "tpcc/tx",
  "run": {
    "executor": "constant-vus",
    "vus": 32,
    "duration": "5m",
    "queryTimeout": "5s"
  },
  "params": {
    "scaleFactor": 10,
    "loadWorkers": 8,
    "pacing": false
  }
}
```

We retained environment names and `-e` as compatibility inputs, but direct flags
and typed config are now the primary interfaces.

## Go-native workloads and data loading

All built-ins now use one Go workload lifecycle for setup, iteration scheduling,
cancellation, teardown, step filters, and metrics.

Loads stream typed batches through `driver.InsertRequest`; every driver consumes
the same source contract. Reusable primitives live in `pkg/gen`, while TPC-H
and TPC-DS retain canonical dbgen and dsdgen algorithms through Go adapters.
Deterministic partition seeking keeps rows stable across workers and batches:

```bash
stroppy run tpcc/tx -d pg \
  --scale-factor 10 \
  --load-workers 8 \
  --steps drop_schema,create_schema,load_data
```

PostgreSQL unlogged loading is now opt-in instead of a default. We also kept the
local SQL override path for dialect work: an explicit `.sql` path is loaded from
the working directory before embedded assets, with no rebuild needed.

## Native metrics and bounded errors

V6 records OpenTelemetry counters, gauges, and fixed-bucket histograms directly.
The final terminal summary includes totals and approximate p50, p90, p95, and
p99 values without retaining every observation for the lifetime of a run.

OTLP export remains available over gRPC or HTTP through config. We also restored
TPC-C's workload report with per-transaction counts, mix, throughput, response
percentiles, and paced-run compliance diagnostics.

We changed how long stress runs handle ordinary database errors. Transactional
workloads classify and retry serialization, deadlock, lock-timeout, and selected
transient failures. When a nonfatal error remains, one iteration fails and the
VU continues. Query-set workloads count the failed query and continue through
the suite.

Warnings are grouped and bounded, and the end of a run prints a prominent
`bench completed with errors` summary. These nonfatal outcomes exit zero so a
run can finish and report its full error rate; strict automation can gate on the
summary marker or terminal-error counters. Setup, validation, teardown, fatal,
and cancellation paths retain nonzero or signal-derived exits.

## A baseline for Stroppy itself

We added `stroppy baseline` because fast database tests can become limited by the
load generator before the database.

```bash
stroppy baseline --quick
```

The command runs two database-free tiers: the Noop driver for framework cost,
and the PostgreSQL driver against the pg-noop blackhole server on loopback for
wire-protocol cost. It measures load throughput plus single-VU and parallel
transaction rates, checks hardware-independent invariants, and saves JSON
history under `~/.stroppy/baselines/`.

Release binaries embed the matching pg-noop server for Linux and macOS on amd64
and arm64. We use the result as a machine-local ceiling, not as a database
benchmark.

## Smaller changes around the edges

The rewrite also gave us room to make several existing paths less surprising:

- SIGINT and SIGTERM now cancel workloads and run teardown; a second signal
  forces exit.
- `--query-timeout` bounds each statement, with MySQL server-side timeout hints
  where applicable.
- Logging uses one replaceable process-wide logger with consistent precedence
  and credential redaction.
- Driver-specific errors map to shared facts, while workload policy decides
  whether to retry, return, ignore, or stop.
- CSV generations publish shards, merged files, and manifests atomically.
- `stroppy probe` reports workload parameter schemas and driver insert
  capabilities without connecting to a database.

This post leaves out many compatibility details and individual correctness
fixes. We collected those in the changelog and migration guide instead of
turning the release post into a second reference manual.

## Migration and links

V6 cannot execute existing TypeScript workload scripts. We kept v5 documentation
available in the version selector, and we wrote a migration guide covering
scenario flags, config fields, workload authoring, metrics, and error behavior.

- [Stroppy v6.0.0 release](https://github.com/stroppy-io/stroppy/releases/tag/v6.0.0)
- [V6 documentation](/docs/introduction)
- [Migrating to v6](/docs/migration-v6)
- [V6 changelog](/docs/changelog)
- [Machine baseline](/docs/baseline)

We are treating v6 as a simpler base for the next round of database work. The
rewrite removed a large amount of code, but the more important result for us is
that workload behavior, configuration, metrics, and drivers now meet in one
place.
