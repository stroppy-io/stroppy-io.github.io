---
sidebar_position: 1
title: Introduction
description: Install Stroppy v6 and run Go-native database benchmarks
---

# Introduction

Stroppy is a database stress-testing CLI distributed as one self-contained Go
binary. It ships deterministic TPC-B, TPC-C, TPC-H, and TPC-DS workloads,
structured SQL support, database drivers, native metrics, and machine-baseline
tools. No separate runtime is required.

## What v6 provides

- **Go-native workload engine** with fixed-iteration and fixed-duration
  executors.
- **Typed workload parameters** exposed as CLI flags and JSON config fields.
- **Deterministic data generation** through reusable typed batches and canonical
  TPC-H/TPC-DS generator adapters.
- **PostgreSQL, MySQL, Picodata, YDB, Noop, and CSV drivers** with explicit
  capability discovery.
- **Structured SQL files** with named sections, named queries, and portable
  `:parameter` binding.
- **Native metrics and summaries**, with optional OpenTelemetry export.
- **`stroppy baseline`**, which measures Stroppy's own framework and PostgreSQL
  wire-protocol ceilings without a database.

If you are upgrading from v5, read [Migrating to v6](./migration-v6) first.

## Architecture

```text
CLI / JSON config / environment compatibility
                    │
                    ▼
       typed parameter resolution
                    │
                    ▼
          Go benchmark engine
     setup → executor → teardown
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
 registered Go workload   SQL / inline SQL
          │                   │
          └─────────┬─────────┘
                    ▼
       registered database driver
   PostgreSQL / MySQL / Picodata / YDB
              Noop / CSV
                    │
                    ▼
       native summary and OTLP metrics
```

Built-in workloads and their SQL/JSON/README assets are compiled into the
binary. A local SQL path can override an embedded dialect file without
rebuilding.

## Installation

### Release archives

Download `v6.0.0` for Linux or macOS, amd64 or arm64, from
[GitHub Releases](https://github.com/stroppy-io/stroppy/releases/tag/v6.0.0).
Extract the archive and place `stroppy` on your `PATH`.

```bash
chmod +x stroppy
sudo install stroppy /usr/local/bin/stroppy
stroppy version
```

Expected shape:

```text
stroppy  v6.0.0
pgx      v5.10.0
```

Machine-readable output:

```bash
stroppy version --json
```

### Docker

```bash
docker pull ghcr.io/stroppy-io/stroppy:v6.0.0.62

docker run --rm ghcr.io/stroppy-io/stroppy:v6.0.0.62 version
```

Use `--network host` when the container must reach databases bound to the host:

```bash
docker run --rm --network host ghcr.io/stroppy-io/stroppy:v6.0.0.62 \
  run tpcc/tx -d pg -D url=postgres://localhost:5432/bench
```

### Build from source

Requires Go 1.26 or newer:

```bash
git clone https://github.com/stroppy-io/stroppy.git
cd stroppy
git checkout v6.0.0
make build
./build/stroppy version
```

## Discover what is available

`probe` reads the catalog compiled into the binary. It does not connect to a
database.

```bash
stroppy probe
stroppy probe -o json
```

It lists:

- registered workloads and their typed parameter schemas;
- embedded SQL dialect and documentation files;
- insert methods supported by every driver.

For one workload's full flag list:

```bash
stroppy run tpcc/tx --help
```

## Quick start

### Measure Stroppy itself

No database needed:

```bash
stroppy baseline --quick
```

Release binaries embed the pg-noop loopback server used by the wire tier. See
[Machine Baseline](./baseline) for interpretation and saved reports.

### Run against PostgreSQL

```bash
stroppy run tpcc/tx -d pg \
  -D url=postgres://host:5432/bench \
  --executor constant-vus --vus 10 --duration 60s
```

### Fixed-iteration run

```bash
stroppy run tpcb/tx -d pg \
  --executor shared-iterations --vus 4 --iterations 100
```

### Load without measuring

```bash
stroppy run tpcc/tx -d pg --scale-factor 10 --load-workers 8 \
  --no-steps workload
```

Then measure against the existing data:

```bash
stroppy run tpcc/tx -d pg --scale-factor 10 \
  --executor constant-vus --vus 64 --duration 10m \
  --steps workload
```

### Run SQL directly

```bash
stroppy run queries.sql -d pg
stroppy run "select 1" -d pg
```

## Input modes

| First positional | Meaning | Example |
|---|---|---|
| Registered workload | Run embedded Go workload | `stroppy run tpch/tx` |
| `.sql` path | Execute SQL file through `execute_sql` | `stroppy run ./queries.sql` |
| String containing spaces | Execute inline SQL | `stroppy run "select 1"` |

A registered workload may take a second positional SQL override:

```bash
stroppy run tpcc/tx ./workloads/tpcc/pico.sql -d pico
```

SQL resolution order:

1. current working directory;
2. `~/.stroppy/`;
3. assets embedded in the binary.

Explicit local `.sql` paths are resolved from the working directory first, so
SQL edits take effect immediately. Short embedded names use the snapshot built
into the binary.

## Configuration sources

Typed parameter precedence, highest first:

1. direct typed CLI flag;
2. process environment;
3. `-e KEY=VALUE` compatibility input;
4. matching typed JSON object (`run` or `params`);
5. JSON `env` compatibility map;
6. workload default.

Driver precedence is `-d`/`-D` over config-file `drivers`.

Use direct flags for new commands:

```bash
stroppy run tpcc/tx --scale-factor 10 --load-workers 8 \
  --executor constant-vus --vus 32 --duration 5m
```

Use [Configuration Files](./config-file) for repeatable runs.

## Next steps

- [Migrating to v6](./migration-v6)
- [Built-in Workloads](./presets)
- [Drivers & Configuration](./drivers)
- [SQL & Generators](./sql-and-generators)
- [Transactions & Errors](./transactions)
- [Reports & Workflow](./reports-workflow)
- [CLI Reference](./cli-reference)
