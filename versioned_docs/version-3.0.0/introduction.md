---
sidebar_position: 1
title: Introduction
description: What is Stroppy, why it's built on k6, and how to get started
---

# Introduction

Stroppy is a database stress testing CLI tool built as an extension to [k6](https://k6.io), Grafana's open-source load testing engine. You write test scripts in TypeScript, define data generators with precise distributions, and run benchmarks that produce detailed metrics and HTML reports.

## Why k6?

Database benchmarking tools tend to fall into two camps: simplistic single-threaded query runners, or sprawling frameworks that require their own infrastructure. Stroppy takes a different path by extending k6:

- **Virtual Users (VUs)** &mdash; k6 manages concurrent goroutines that each execute your test script independently. You get real concurrency without thread management.
- **Scenarios** &mdash; Define exactly how load ramps up, holds steady, or varies over time. Constant VUs, ramping VUs, shared iterations, per-VU iterations &mdash; all built in.
- **Thresholds** &mdash; Set pass/fail criteria on any metric. If p95 latency exceeds 200ms, the test fails.
- **Real-time dashboard** &mdash; Watch metrics live in the browser while the test runs.
- **HTML report export** &mdash; Get a self-contained report at the end of every run.
- **Ecosystem** &mdash; JSON output, InfluxDB, Prometheus, Datadog, and more output formats work out of the box.

Stroppy adds what k6 lacks for database testing: a driver abstraction, parameterized SQL execution, data generation with statistical distributions, and bulk insertion (including PostgreSQL COPY protocol).

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Your Test Script (.ts)           │
│  ┌─────────────┐  ┌────────────┐  ┌───────────┐  │
│  │   DriverX    │  │ Generators │  │  k6 APIs  │  │
│  │  .runQuery() │  │  R / S     │  │ scenarios │  │
│  │  .insert()   │  │  NewGen()  │  │ thresholds│  │
│  └──────┬───────┘  └─────┬──────┘  └───────────┘  │
└─────────┼────────────────┼─────────────────────────┘
          │                │
    ┌─────▼────────────────▼─────┐
    │    k6/x/stroppy module     │
    │    (Go, compiled into k6)  │
    └─────┬────────────────┬─────┘
          │                │
   ┌──────▼──────┐  ┌──────▼──────┐
   │   Driver    │  │  Generator  │
   │  Registry   │  │   Engine    │
   │  (postgres) │  │ (uniform,   │
   │             │  │  normal,    │
   │             │  │  zipfian)   │
   └──────┬──────┘  └─────────────┘
          │
   ┌──────▼──────┐
   │  PostgreSQL │
   │   (pgx)     │
   └─────────────┘
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
stroppy  v3.0.0
k6       v1.6.0
pgx      v5.8.0
```

This shows the versions of Stroppy itself and its key dependencies (k6 engine, PostgreSQL driver). For programmatic use, `stroppy version --json` outputs the same information as JSON.

## Quick Start

### 1. Generate a workspace

```bash
stroppy gen --workdir mytest --preset=simple
```

This creates a directory with:
- The stroppy binary (or symlink to it)
- TypeScript test templates and type definitions
- Helper framework files
- `package.json` for npm dependencies

Available presets: `simple`, `tpcb`, `tpcc`, `tpcds`, `execute_sql`.

### 2. Install dependencies

```bash
cd mytest
npm install
```

### 3. Run a test

Stroppy resolves short preset names automatically &mdash; no need to type full paths:

```bash
# Against local PostgreSQL (default: postgres://postgres:postgres@localhost:5432)
stroppy run simple

# With a custom database URL
DRIVER_URL="postgres://user:pass@host:5432/mydb" stroppy run simple
```

### 4. Run with an SQL file

Some workloads pair a TypeScript script with a SQL file. Stroppy auto-derives the SQL file from the preset name:

```bash
stroppy run tpcb                   # resolves tpcb.ts + tpcb.sql from built-in workloads
stroppy run tpcds tpcds-scale-100  # explicit SQL variant from the tpcds preset
```

### 5. Pass k6 arguments

Everything after `--` is forwarded to k6:

```bash
stroppy run simple -- --vus 10 --duration 30s
```

### 6. Select steps

Use `--steps` or `--no-steps` to run only specific setup phases:

```bash
stroppy run tpcc --steps create_schema,load_data   # only run these steps
stroppy run tpcc --no-steps load_data               # skip data loading
```

## A Minimal Test Script

```typescript
import { Options } from "k6/options";
import { Teardown } from "k6/x/stroppy";
import { DriverConfig_DriverType } from "./stroppy.pb.js";
import { DriverX, ENV } from "./helpers.ts";

export const options: Options = {};

const driver = DriverX.create().setup({
  url: ENV("DRIVER_URL", "postgres://postgres:postgres@localhost:5432", "Database connection URL"),
  driverType: DriverConfig_DriverType.DRIVER_TYPE_POSTGRES,
  driverSpecific: {
    oneofKind: "postgres",
    postgres: {},
  },
});

export default function () {
  // Run a simple query
  driver.exec("SELECT 1;");

  // Run a parameterized query
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
docker run --network host \
  -e DRIVER_URL="postgres://user:pass@host:5432/db" \
  ghcr.io/stroppy-io/stroppy run tpcb

# Generate a workspace to your host
docker run -v $(pwd):/workspace ghcr.io/stroppy-io/stroppy \
  gen --workdir mytest --preset=simple
```

## File Resolution

When you run `stroppy run tpcc`, Stroppy resolves the script and SQL files through a search path:

1. **Current directory** (`./`)
2. **`~/.stroppy/`** (if it exists)
3. **Built-in workloads** (embedded in the binary)

Script and SQL resolve **independently** &mdash; drop a custom `tpcc.sql` in your current directory to override the SQL while using the built-in `tpcc.ts`.

The extension determines the mode:

| Input | Mode | Example |
|-------|------|---------|
| No extension | Preset | `stroppy run tpcc` |
| `.ts` | Script | `stroppy run bench.ts` |
| `.sql` | SQL file | `stroppy run queries.sql` |
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

- [SQL & Generators](./sql-and-generators) &mdash; Deep dive into parameterized SQL and the data generation system
- [Extensibility](./extensibility) &mdash; How to add your own database driver
- [Reports & Workflow](./reports-workflow) &mdash; HTML reports and the iterative testing workflow
- [MCP Server](./mcp) &mdash; Use Stroppy through Claude Code and other AI assistants
