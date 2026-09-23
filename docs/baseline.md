---
sidebar_position: 9
title: Machine Baseline
description: Measure Stroppy's framework and PostgreSQL wire-protocol ceilings without a database
---

# Machine Baseline

`stroppy baseline` measures Stroppy's own performance ceiling on the current
machine. It needs no database and does not claim to measure database
performance.

```bash
stroppy baseline
```

A full run takes roughly 20 seconds. For a faster smoke test:

```bash
stroppy baseline --quick
```

## What it measures

The command runs a fixed-shape built-in workload through two tiers:

| Tier | Path | Meaning |
|---|---|---|
| `noop` | Go workload → benchmark engine → Noop driver | Framework cost: generation, parameters, metrics, and transaction bookkeeping without network or database I/O. |
| `wire` | Same workload → PostgreSQL driver → pg-noop on loopback | Framework plus pgx pool, TCP loopback, and PostgreSQL wire-protocol cost. |

[pg-noop](https://github.com/stroppy-io/pg-noop) is a blackhole PostgreSQL
protocol server. It drains requests and returns stub responses faster than
Stroppy can generate work, so the wire tier isolates client-side overhead.

Each tier records:

- typed load throughput in rows/second;
- transaction throughput and latency at one VU;
- transaction throughput and latency at the selected parallel VU count
  (GOMAXPROCS by default).

A real database result cannot sustainably exceed the corresponding client-side
wire ceiling on the same machine and workload shape.

## Running selected tiers

```bash
stroppy baseline --tiers noop
stroppy baseline --tiers wire
stroppy baseline --tiers noop,wire
```

The Noop tier needs no companion process. The wire tier starts pg-noop on a
loopback port and tears it down after measurement.

## Server resolution

The wire tier resolves pg-noop in this order:

1. copy embedded in released Linux/macOS amd64/arm64 binaries;
2. target-specific cache under
   `~/.stroppy/bin/pg-noop/<version>/<os>-<arch>/`;
3. consented download from the pinned pg-noop GitHub release, verified against
   checksums pinned in Stroppy.

Supply a binary directly when using an unsupported platform or local build:

```bash
stroppy baseline --server-path ./pgnoop
```

Equivalent environment input:

```bash
STROPPY_PG_NOOP_PATH=./pgnoop stroppy baseline
```

Download policy:

```bash
stroppy baseline --download ask
stroppy baseline --download always
stroppy baseline --download never
```

`ask` is the default. Non-interactive automation should choose explicitly.

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--quick` | `false` | Use one-second phases and a smaller load. |
| `--tiers` | `noop,wire` | Tier list to run. |
| `--vus` | GOMAXPROCS | VUs for the parallel transaction phase. |
| `--duration` | `3s` | Duration of each transaction phase (`1s` with `--quick`). |
| `--rows` | `250000` | Rows in each load phase (`100000` with `--quick`). |
| `--json` | `false` | Print machine-readable report JSON to stdout. |
| `--no-save` | `false` | Do not save report history. |
| `--server-path` | unset | Explicit pg-noop executable. |
| `--download` | `ask` | Download consent: `ask`, `always`, or `never`. |

## Verdicts

Verdicts check hardware-independent invariants rather than fixed throughput
thresholds:

- **measurement sanity** — each selected phase recorded work;
- **errors** — no failed iterations;
- **VU scaling** — parallel rate compared with ideal linear scaling;
- **loopback latency floor** — wire p99 should remain below 1 ms;
- **latency noise** — wire p99/p50 spread;
- **tier ordering** — Noop should remain faster than wire.

Warnings do not necessarily mean broken hardware. Stroppy's OpenTelemetry
metric pipeline contends at very high iteration rates, so fast machines can hit
a throughput plateau and report weak scaling. Rerun before drawing conclusions.

Absolute rates vary with CPU, scheduler, power policy, virtualization, and
background load. Compare repeated runs on the same host instead of treating one
machine's rate as universal.

## Saved reports

Unless `--no-save` is set, each run writes a schema-versioned JSON report under:

```text
~/.stroppy/baselines/
```

Same-second runs receive numeric filename suffixes instead of overwriting each
other. Text output compares the run with the previous saved report when a
compatible predecessor exists.

Use JSON mode for automation:

```bash
stroppy baseline --quick --json > baseline.json
```

History and comparison diagnostics go to stderr, leaving stdout as one valid
JSON document.

## Reading a baseline against a database run

- A database run near the wire ceiling is likely client-bound. More VUs or pool
  capacity may help until Stroppy itself saturates.
- A database run far below the wire ceiling is dominated by database or network
  work, which is normal for meaningful workloads.
- Compare like with like: executor, VUs, SQL shape, transaction shape, and
  machine placement all matter.

Baseline uses a synthetic workload and stub server, not TPC correctness or
server durability. Use it to bound client overhead, then use a real workload to
measure the database.
