---
sidebar_position: 1
title: Introduction
description: What is Stroppy, why it's built on k6, and how to get started
---

# Introduction

Stroppy is a database stress testing CLI built as an extension to [k6](https://k6.io). You write TypeScript workload scripts, define relational data with deterministic generators, run them through database drivers, and get k6 metrics, dashboards, and reports.

## Why k6?

Database benchmarking tools tend to fall into two camps: simplistic query runners, or large frameworks that require their own orchestration. Stroppy takes a different path by extending k6:

- **Virtual Users (VUs)** &mdash; k6 manages concurrent goroutines that execute your script independently.
- **Scenarios** &mdash; Use k6's built-in executors, durations, iterations, and ramping patterns.
- **Thresholds** &mdash; Fail runs automatically when latency or error-rate criteria are breached.
- **Real-time dashboard** &mdash; Watch metrics live in the browser.
- **HTML report export** &mdash; Save a self-contained report after a run.
- **Ecosystem** &mdash; JSON, InfluxDB, Prometheus, Datadog, and other k6 outputs work with Stroppy.

Stroppy adds what k6 lacks for database testing: PostgreSQL, MySQL, Picodata, YDB, Noop, and CSV drivers; transaction helpers; named SQL parameters; relational InsertSpec loading; and deterministic data generation through `Rel`, `Attr`, `Draw`, `DrawRT`, and `Expr`.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Your Test Script (.ts)           │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │   DriverX    │  │   Datagen     │  │ k6 APIs  │ │
│  │  .exec()     │  │ Rel.table()   │  │ options  │ │
│  │  .beginTx()  │  │ Attr/Draw/Expr│  │ metrics  │ │
│  │  .insertSpec │  │ DrawRT        │  │ reports  │ │
│  └──────┬───────┘  └──────┬────────┘  └──────────┘ │
└─────────┼─────────────────┼────────────────────────┘
          │                 │
    ┌─────▼─────────────────▼─────┐
    │       k6/x/stroppy module    │
    │          (Go + k6)           │
    └─────┬─────────────────┬─────┘
          │                 │
    ┌─────▼─────┐     ┌─────▼─────┐
    │  Driver   │     │ Datagen   │
    │ Registry  │     │ Runtime   │
    │ pg/mysql/ │     │ seeded,   │
    │ pico/ydb/ │     │ parallel  │
    │ noop/csv  │     │ rows      │
    └─────┬─────┘     └───────────┘
          │
    ┌─────▼─────┐
    │ Database  │
    │ or sink   │
    └───────────┘
```

## Installation

### Pre-built binaries

Download from [GitHub Releases](https://github.com/stroppy-io/stroppy/releases).

### Docker

```bash
docker pull ghcr.io/stroppy-io/stroppy:latest
```

### Build from source

Requires Go 1.24.3+:

```bash
git clone https://github.com/stroppy-io/stroppy.git
cd stroppy
make build
# Binary at ./build/stroppy
```

### Verify installation

```bash
stroppy version
```

```
stroppy  v5.1.2
k6       v1.7.0
pgx      v5.8.0
```

For programmatic use, `stroppy version --json` outputs the same information as JSON.

## Quick Start

### 1. Generate a workspace

```bash
stroppy gen --workdir mytest --preset=simple
```

This creates a directory with:

- The Stroppy binary and k6 symlink.
- TypeScript helpers and generated proto files.
- `helpers.ts`, `datagen.ts`, and `parse_sql.ts`.
- `package.json` for TypeScript dependencies.

Available presets: `simple`, `tpcb`, `tpcc`, `tpch`, `tpcds`, `execute_sql`.

### 2. Install dependencies

```bash
cd mytest
npm install
```

### 3. Run a test

Stroppy resolves built-in workload names automatically:

```bash
# Against local PostgreSQL
stroppy run simple

# With a specific driver and custom URL
stroppy run simple -d pg -D url=postgres://user:pass@host:5432/mydb
```

### 4. Run a multi-dialect workload

Current built-in workloads usually choose a SQL dialect file from the active driver type:

```bash
stroppy run tpcc/tx -d pg          # uses the PostgreSQL TPC-C SQL variant
stroppy run tpcb/tx -d ydb         # uses the YDB TPC-B SQL variant
stroppy run tpcds tpcds-scale-100  # explicit TPC-DS query file
```

### 5. Pass k6 arguments

Everything after `--` is forwarded to k6:

```bash
stroppy run tpcb/tx -- --vus 10 --duration 30s
```

### 6. Select steps

Use `--steps` or `--no-steps` to run only specific setup phases:

```bash
stroppy run tpcc/tx --steps create_schema,load_data
stroppy run tpcc/tx --no-steps load_data
```

## A Minimal Test Script

```typescript
import { Options } from "k6/options";
import { Teardown } from "k6/x/stroppy";
import { DriverX, declareDriverSetup } from "./helpers.ts";

export const options: Options = {};

const driverConfig = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
});

const driver = DriverX.create().setup(driverConfig);

export default function () {
  driver.exec("SELECT 1");
  driver.exec("SELECT :a + :b", { a: 10, b: 20 });
}

export function teardown() {
  Teardown();
}
```

## Docker Usage

```bash
# Run built-in workloads directly
docker run --network host ghcr.io/stroppy-io/stroppy run simple

# TPC-B benchmark with custom DB
docker run --network host ghcr.io/stroppy-io/stroppy run tpcb/tx \
  -d pg -D url=postgres://user:pass@host:5432/db

# Generate a workspace to your host
docker run -v $(pwd):/workspace ghcr.io/stroppy-io/stroppy \
  gen --workdir mytest --preset=simple
```

## File Resolution

When you run `stroppy run tpcc/tx`, Stroppy resolves the script and SQL files through a search path:

1. **Current directory** (`./`).
2. **`~/.stroppy/`**.
3. **Built-in workloads** embedded in the binary.

Script and SQL resolve independently. Current multi-dialect workloads usually choose the SQL file inside TypeScript based on `driverType`, but a second positional SQL argument or `SQL_FILE` override takes priority:

```bash
stroppy run tpcc/tx tpcc/pico -d pico
stroppy run tpch/tx tpch/mysql -d mysql
```

The extension determines the input mode:

| Input | Mode | Example |
|-------|------|---------|
| No extension | Preset/script name | `stroppy run tpcc/tx` |
| `.ts` | Script path | `stroppy run bench.ts` |
| `.sql` | SQL file mode | `stroppy run queries.sql` |
| Quoted string | Inline SQL | `stroppy run "SELECT 1"` |

## Using the k6 Binary Directly

Stroppy is a k6 extension. The build produces both `stroppy` and `k6` binaries:

```bash
make build

# Use k6 directly with full k6 CLI
./build/k6 run --vus 10 --duration 30s test.ts

# JSON output
./build/k6 run --out json=results.json test.ts

# Stroppy commands via k6 extension
./build/k6 x stroppy run workloads/simple/simple.ts
```

## Next Steps

- [SQL & Generators](./sql-and-generators) &mdash; Parameterized SQL, structured SQL files, and current relational data generation.
- [Drivers & Configuration](./drivers) &mdash; Driver presets, connection pools, multi-driver setups, and CLI flags.
- [Configuration Files](./config-file) &mdash; Repeatable JSON configs for drivers, env vars, steps, global settings, and k6 args.
- [Transactions](./transactions) &mdash; Database transactions with configurable isolation levels.
- [Built-in Workloads](./presets) &mdash; Embedded workload presets and variants.
- [Tests](/docs/tests/tpcc) &mdash; TPC-C and TPC-H workload details.
- [Probe & Script Parameters](./probe) &mdash; Inspect workloads, discover parameters, filter steps.
- [CLI Reference](./cli-reference) &mdash; Complete reference for commands, flags, and environment variables.
- [Extensibility](./extensibility) &mdash; How to add a database driver.
- [Reports & Workflow](./reports-workflow) &mdash; HTML reports and iterative benchmarking workflow.
- [MCP Server](./mcp) &mdash; Use Stroppy through Claude Code and other AI assistants.
