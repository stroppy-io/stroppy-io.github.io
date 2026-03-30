---
slug: performance-testing-in-ci
title: "How We Catch Performance Regressions Before They Hit Production"
authors: [stroppy-authors]
tags: [ci, performance, tpc-c, orioledb, github-actions, monitoring]
---

Imagine this scenario: a developer submits a Pull Request with an optimization. The reviewer examines the code, finds it correct, and approves it. A month later, it turns out that this "optimization" slowed down a critical path by 30%, but nobody noticed - because nobody measured. Finding the offending commit among dozens of merges is a matter of days, and reverting it is even harder.

This is a universal problem for any database engine, storage system, or performance-sensitive project. The only reliable solution is to measure automatically, on every PR, and present the results where the decision is being made - right in the pull request.

[Stroppy](https://github.com/stroppy-io/stroppy) is a multi-database, multi-benchmark performance testing tool built on top of [K6](https://k6.io/). It supports various workload types and database targets, with ready-made presets, structured result collection, and native CI integration via [stroppy-action](https://github.com/stroppy-io/stroppy-action).

This article is a concrete case study: how we used Stroppy to build an automated performance testing pipeline for [OrioleDB](https://github.com/orioledb/orioledb) in GitHub Actions. Along the way, we tackled reproducibility, monitoring, and test acceleration - problems that arise in any CI performance testing setup.

<!-- truncate -->

### What is OrioleDB

OrioleDB is a PostgreSQL extension that implements a fundamentally different storage engine. Instead of the standard heap-based storage, where every UPDATE creates a new row version and leaves a dead tuple for vacuum, OrioleDB offers an undo-log architecture with row-level WAL. This provides more efficient MVCC handling, virtually zero bloat, and better performance on OLTP workloads. The architecture is tightly coupled with performance at the level of every line of code - a change in B-tree traversal or in the checkpoint procedure can unexpectedly affect throughput or latency. This makes automated performance testing not a "nice to have" but a necessity.

---

## Why test performance at the PR stage

One might argue: "we already run benchmarks before a release." But testing at the release stage is a post-mortem diagnosis. The regression is already in the code, already mixed in with dozens of other changes, and finding its source is a separate research task.

Testing at the PR stage solves three fundamental problems:

**Regressions are caught at the point of origin.** When a benchmark shows "-12% throughput" on a specific PR - the culprit is obvious. No need to bisect the commit history, no need to reproduce the problem. The PR author sees the result and can fix or justify the regression right in the discussion.

**Optimizations get evidence-based backing.** A PR with the description "sped up checkpoint by 20%" without numbers is a claim. A PR with an automated comment showing +18.3% iterations/s and -15.7% p95 latency is a fact. The reviewer sees not only that the code is correct, but that it actually improves things.

**Manual benchmarks are no longer a bottleneck.** "It got faster on my laptop" is not a valid argument and cannot be one. Different machines, different configurations, different background noise from other processes. Automation eliminates the human factor: the same machine, the same test, automatic comparison, reproducible results.

Our specific goal: on every PR in GitHub, a comment is automatically published with a "base vs head" table for key TPC-C metrics - throughput (iterations/s, queries/s) and latency (avg, median, p90, p95). The :white_check_mark: and :warning: indicators appear when deviation exceeds 3%, so the reviewer can instantly see whether there is cause for concern.

![GitHub Actions pipeline: base and head benchmarks running in parallel](/img/blog/oriole-ci-action-view.jpg)

---

## Making performance tests reliable

An automated benchmark is useless if its results cannot be trusted. A 20% spread between runs, unpredictable timeouts, non-reproducible conditions - all of this turns the system from a decision-making tool into a noise generator. Reliability comes from three components: choosing the right benchmark, the right tool to run it, and the right environment configuration.

### Choosing the benchmark: TPC-C

The first candidate was pgbench - the standard PostgreSQL tool. It is simple, bundled with the distribution, and familiar to everyone. But pgbench implements TPC-B - a simplified benchmark with three tables and a single transaction type. For a storage engine that handles complex OLTP scenarios, this is too primitive.

TPC-C is a different story. Five transaction types (new_order, payment, delivery, order_status, stock_level), nine tables with foreign keys, different access patterns - from point lookups to range scans. This is much closer to a real workload and better at revealing regressions in various code paths of the engine.

### Running TPC-C with Stroppy

Stroppy handles the full TPC-C cycle: schema generation, data loading (COPY for maximum speed), running the workload with the correct transaction distribution, and collecting results into structured JSON. Unlike bare K6, where you have to write the SQL and TPC-C logic yourself, Stroppy provides a ready-made preset with the correct transaction proportions and a proper data model.

### stroppy-action: CI integration in a few lines of YAML

To run Stroppy in CI, we use [stroppy-action](https://github.com/stroppy-io/stroppy-action) - a GitHub Action that encapsulates the entire process: installing the required Stroppy version, generating a script from a preset, running the benchmark, and uploading results as an artifact. The workflow file stays clean - a few lines of YAML instead of dozens of bash commands.

During pipeline development, we discovered that the action did not allow passing arguments directly to Stroppy (only to K6). This became an issue when we needed to skip data loading when a cache was available (more on this below). The argument `--steps workload` is a command for Stroppy and must go *before* the `--` separator, not after it. We added a separate `stroppy-args` input so that the final command would look correct:

```
stroppy run tpcc.ts tpcc.sql --steps workload -- --summary-mode full --out opentelemetry
```

This illustrates a general principle: a tool must be flexible enough not to become a limitation. We did not foresee the need for `stroppy-args` at the start, but the architecture allowed adding it without breaking changes.

### PostgreSQL configuration: balancing realism and stability

The `perf_pg_start.sh` script configures PostgreSQL so that results are both realistic and reproducible:

- **`shared_buffers` = 25% RAM** - computed automatically from `/proc/meminfo`. This is the standard PostgreSQL recommendation for dedicated servers, and automatic calculation ensures that the configuration adapts when moving to a different machine.
- **`max_connections = 200`** - sufficient for 99 K6 virtual users with headroom to spare.
- **`max_wal_size = 4GB`** - reduces checkpoint frequency, which can introduce unpredictable pauses during the benchmark.
- **`default_table_access_method = 'orioledb'`** - all tables are automatically created through OrioleDB rather than the standard heap.
- **`--disable-cassert` at build time** - this is a critical point. Asserts in PostgreSQL are a powerful development tool, but they can slow things down by 2-3x. The benchmark must measure the production configuration, not the debug mode.

---

## Obtaining an objective assessment

Even a reliable benchmark with the right configuration is useless if the runtime conditions are not controlled. A 5% throughput difference can be a real regression or it can be an artifact of apt-get upgrade running on the machine at the same time. Objectivity requires control over both the environment and the comparison methodology.

### Dedicated machines instead of shared runners

GitHub provides shared runners - virtual machines shared among all users. This works great for functional tests, but is absolutely unsuitable for performance testing. The "noisy neighbor" effect on shared infrastructure can produce variation of tens of percent between runs.

That is why benchmarks run on self-hosted runners - dedicated servers labeled `perf-runner`. These machines perform no other tasks, their configuration is fixed, and the only variable between runs is the code being tested.

![Self-hosted perf-runners in GitHub Actions](/img/blog/oriole-runners-view.jpg)

### Comparison methodology: base vs head

The workflow is built around comparing two branches within a single run. This is essential: if bench-base ran on Monday and bench-head on Wednesday - the results are incomparable (machine temperature, OS background processes, disk state). Both benchmarks must run under conditions that are as close as possible.

The pipeline runs both benchmarks in parallel on separate identical machines, then compares results and posts a comment to the PR:

```mermaid
graph LR
    PR["PR opened"] --> Setup["setup<br/>(generate matrix)"]
    Setup --> Base["bench-base<br/>runner-1"]
    Setup --> Head["bench-head<br/>runner-2"]
    Base --> Compare["compare<br/>(perf_compare.py)"]
    Head --> Compare
    Compare --> Comment["PR comment<br/>with results"]
```

Initially, bench-head depended on bench-base (`needs: bench-base`), and both had a `max-parallel: 1` constraint. This was an excess of caution: we were worried about resource contention. But once it became clear that the runners are on different physical machines, and a GitHub Actions runner by design executes only one job at a time - the constraints were removed. The total run time was cut in half.

### Configurable parameters

The workflow supports execution via `workflow_dispatch` with configurable parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `warehouses` | 200 | Number of TPC-C warehouses (comma-separated for matrix) |
| `bench_duration` | 25m | Duration of a single run |
| `bench_runs` | 1 | Number of runs (for computing the median) |
| `vus_scale` | 1 | Virtual user multiplier (1 = 99 VU) |
| `pool_size` | 100 | Connection pool size |
| `base_ref` | main | Base branch for comparison |

200 warehouses and 25 minutes are not arbitrary numbers. A small number of warehouses (1-10) creates an unrealistically hot dataset where everything fits in the buffer cache. 200 warehouses generate ~26 million rows - enough that the data does not fit entirely in shared_buffers and the benchmark reflects real I/O patterns. 25 minutes is enough for the system to reach a stable state after warmup and for the results to be statistically significant.

When more precise measurements are needed, you can specify `bench_runs: 3` - the system will perform three runs and take the median, smoothing out random fluctuations.

---

## Monitoring: from numbers to understanding

A benchmark produces final numbers - throughput and latency. But when those numbers are unexpectedly bad, you need to understand *why*. CPU bottleneck? Swapping? Checkpoints too frequent? Deadlocks? Without monitoring, a benchmark is a black box.

### Stroppy's OpenTelemetry integration

This is where Stroppy's built-in observability becomes essential. Since Stroppy is built on K6, it inherits K6's native OpenTelemetry support - the ability to stream benchmark metrics in real time via OTEL protocol. This is not just an aggregated summary at the end; it is a live view of how throughput and latency evolve over the course of a 25-minute test. Was there a dip in the middle? Did latency stabilize after warmup? Did a checkpoint cause a throughput drop?

In the workflow, this is activated with a single argument:

```yaml
k6-args: '--out opentelemetry'
```

The configuration lives entirely on the runner side - via environment variables in a `.env` file:

```
K6_OTEL_EXPORTER_TYPE=http
K6_OTEL_HTTP_EXPORTER_ENDPOINT=vminsert.stroppy.io
K6_OTEL_HTTP_EXPORTER_URL_PATH=/insert/multitenant/opentelemetry/v1/metrics
K6_OTEL_METRIC_PREFIX=oriole_ci_
K6_OTEL_SERVICE_NAME=stroppy_oriole_ci
```

The CI pipeline knows nothing about the endpoint, the credentials, or the fact that metrics are being sent anywhere at all. This transparency is a deliberate choice: the CI pipeline should remain simple and portable, while the infrastructure layer is configured separately.

### Infrastructure monitoring around the benchmark

Stroppy's OTEL metrics are one of three data streams we collect. To get the full picture, we added infrastructure-level monitoring that runs continuously on each runner as systemd services - completely transparent to CI:

- **[node_exporter](https://github.com/prometheus/node_exporter)** - system metrics: CPU, memory, disk I/O, network. Answers whether the benchmark is CPU-bound, whether there is swap activity, or whether disk is saturated by checkpoints.
- **[postgres_exporter](https://github.com/prometheus-community/postgres_exporter)** - database internals: transactions per second, buffer cache hit ratio, locks, checkpoint statistics. If K6 shows a throughput drop and the hit ratio fell from 99% to 85% - you know the problem is cache misses, not locks.
- **[otelcol-contrib](https://opentelemetry.io/docs/collector/)** - PostgreSQL log collection in real time, parsed by severity and sent to VictoriaLogs. An ERROR during index creation or a FATAL at startup can explain unexpected benchmark results instantly.

All three streams converge in a unified monitoring stack:

```mermaid
graph LR
    subgraph Runner
        NE["node_exporter<br/>:9100"]
        PE["postgres_exporter<br/>:9187"]
        OC["otelcol-contrib"]
        K6["Stroppy / K6"]
        PGLog["postgresql.log"]
    end

    subgraph "vminsert.stroppy.io"
        VM["VictoriaMetrics"]
        VL["VictoriaLogs"]
    end

    NE -->|"vmagent<br/>remote_write"| VM
    PE -->|"vmagent<br/>remote_write"| VM
    PGLog --> OC -->|"OTLP HTTP"| VL
    K6 -->|"OTLP HTTP"| VM

    VM --> Grafana
    VL --> Grafana
```

Visualization is handled by Grafana at `grafana.stroppy.io`. A single dashboard shows all three layers simultaneously: machine load, PostgreSQL state, and benchmark results. Time-based correlation makes it instantly visible that a throughput dip at the 12th minute coincided with a long checkpoint and a spike in disk I/O.

![Stroppy benchmark dashboard in Grafana](/img/blog/stroppy-dashboard.png)

![Node exporter dashboard: CPU, memory, disk, and network during the benchmark](/img/blog/node-exporter-dashboard.jpg)

---

## Speeding up tests

Reliability and testing depth are worthless if the developer waits three hours for PR results. In CI, feedback speed is just as much on the critical path as quality. A PR waiting hours for a benchmark blocks work, accumulates merge conflicts, and reduces developers' motivation to use the system. A system that nobody uses is useless.

### The problem: data loading as a bottleneck

TPC-C for 200 warehouses is ~26 million rows of data: 6 million customer records, 20 million stock entries, 100 thousand items, plus warehouses, districts, orders, and order_lines. Stroppy loads all of this via PostgreSQL COPY - the fastest method for bulk insertion, but even it takes 15-30 minutes for this volume.

Moreover, loading happens twice - for the base branch and for the head branch. That is 30-60 minutes just for data preparation, with a 25-minute benchmark itself. Total PR time exceeds one hour, of which the useful work (the actual benchmark) takes less than half.

### The key insight: data does not depend on code

TPC-C data is a fixed set of rows determined by two parameters: the PostgreSQL version and the number of warehouses. The code under test affects the *speed of working* with this data, but not the data itself. The warehouse, customer, and stock tables are the same for any commit.

An important caveat: by skipping data loading, we deliberately exclude the insertion path (INSERT/COPY) from measurements. Insert performance is a separate and important characteristic, but it deserves its own benchmark with its own methodology, which is beyond the scope of this article.

This means the data can be loaded once and reused. Self-hosted runners preserve state between runs - an ideal environment for a local cache.

### Implementation: pgdata cache

The `perf_db_cache.sh` script implements a two-phase cache:

**Cache key:** `${PG_VERSION}-${WAREHOUSES}W` - for example, `17-200W`. It deliberately does not include the commit SHA, so that the cache is reused across different code versions.

**Restore phase** (before the benchmark): the script checks for the existence of the cached pgdata directory. If the cache exists - PostgreSQL is stopped, pgdata is replaced with the cached copy, PostgreSQL is restarted. The variable `DB_CACHED=true` tells subsequent steps that data loading is not needed.

**Save phase** (after the first benchmark): if there was no cache and Stroppy loaded data from scratch - PostgreSQL is stopped, pgdata is copied to the cache, PostgreSQL is restarted. No more than four caches are stored; the oldest ones are deleted automatically.

When the cache is available, Stroppy is launched with the argument `--steps workload`, skipping the schema creation and data loading phases:

```yaml
stroppy-args: ${{ env.DB_CACHED == 'true' && '--steps workload' || '' }}
```

### Result: PR time cut in half

| Stage | Without cache | With cache |
|-------|--------------|------------|
| Build PG + OrioleDB | ~2 min (build cache) | ~2 min |
| Load TPC-C data | 15-30 min | ~5 min (cp -a 24GB) |
| Benchmark | 25 min | 25 min |
| **Total per single run** | **~45 min** | **~32 min** |
| **base + head (parallel)** | **~45 min** | **~32 min** |

The first run with a new warehouse count proceeds in full and creates the cache. All subsequent runs use this cache regardless of the code version. The cache is automatically invalidated when the PostgreSQL version or the number of warehouses changes.

Copying 24GB of pgdata takes ~5 minutes - not instant, but 3-6x faster than loading via COPY. Combined with running base and head in parallel on two machines, the total PR time is ~32 minutes - acceptable for CI.

---

## Conclusion

The automated performance testing pipeline is not one large project, but a sequence of responses to specific problems:

- Need an objective assessment of PR performance -> **automated TPC-C benchmark** via Stroppy with results published as a comment.
- Results cannot be trusted on shared runners -> **dedicated self-hosted runners** with fixed configuration.
- Unclear why results look the way they do -> **full monitoring stack** with Stroppy's OTEL integration at its core, plus system and database metrics via VictoriaMetrics and Grafana.
- PR waits too long for results -> **TPC-C data caching** and **parallel execution** of base/head on separate machines.

Each of these solutions is minimal in code volume but significant in impact. The pgdata cache is 70 lines of shell script that reduces PR time by 15-30 minutes. The permissions block is one line of YAML that eliminates 403 errors.

The result is a system that developers use not because they have to, but because it is useful. On every PR, a concrete answer arrives: "throughput +2.3%, p95 latency -1.8%" - and those numbers can be trusted.

---

## Try it yourself

- **[Stroppy](https://github.com/stroppy-io/stroppy)** - the benchmark tool. Supports multiple databases and workload types.
- **[stroppy-action](https://github.com/stroppy-io/stroppy-action)** - the GitHub Action for CI integration.
- **[stroppy.io](https://stroppy.io)** - documentation and guides.

A minimal workflow to get started with performance testing on your project:

```yaml
- uses: stroppy-io/stroppy-action@v1
  with:
    preset: tpcc
    pg-conn-string: postgresql://user:pass@localhost:5432/bench
```
