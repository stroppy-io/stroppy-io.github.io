---
slug: why-stroppy-moved-off-k6
title: "Why We Moved Stroppy from k6 to a Native Go Engine"
authors: [stroppy-authors]
tags: [architecture, performance, go, k6, v6]
---

Stroppy v5 was a k6 extension. Stroppy v6 is not.

We did not make that change because k6 is a poor load-testing tool. k6 gave us
virtual users, scenarios, metrics, reporting, and a JavaScript runtime when
Stroppy was much smaller. It helped us reach a working multi-database benchmark
faster than building every subsystem ourselves.

The problem was fit. As Stroppy became a database benchmark rather than a thin
extension, we used less of what k6 was built to provide and added more adapters
around the parts we did use. Eventually the adapter layer became the product.

{/* truncate */}

## What we needed, and what we carried

Stroppy workloads make synchronous database calls. They load relational data,
run transactions or analytical queries, collect timings, and repeat. The core
shape is closer to pgbench, sysbench, go-tpc, or BenchBase than to an HTTP test
with an asynchronous event loop.

From k6 we mainly needed:

- virtual-user scheduling;
- fixed-duration and fixed-iteration execution;
- cancellation and lifecycle hooks;
- metrics and summaries.

We also carried an event loop, HTTP-oriented VU machinery, a JavaScript
interpreter, module loading, option consolidation, CLI behavior, output
plumbing, and extension boundaries. Most of that machinery was useful in k6's
own domain. Very little of it helped a synchronous SQL call complete.

Carrying unused code was not the decisive problem by itself. The harder part was
that the pieces we needed did not line up with Stroppy's lifecycle.

## Integration friction became architecture

K6 is an application, not a library API for embedding its full CLI lifecycle.
To run it in process, v5 saved, rewrote, and restored `os.Args`, environment
variables, and the working directory around the k6 command. We intercepted
`os.Exit` and replaced signal handling so Stroppy could recover control.

Probe was another example. We wanted one command that described a workload's
parameters, steps, SQL, and drivers without running it. The script was the only
source of that information, so v5 built a fake k6 environment with stubbed
drivers, transactions, rows, and random pickers. The extractor reached 674 lines
and rewrote imports before evaluating a script. We maintained a second runtime
model so the first runtime could be inspected without doing work.

Lifecycle mismatches spread into workloads too. K6 offered setup, execution, and
teardown, while Stroppy needed explicitly named schema, load, index, validation,
and workload phases with filters. We built `Step()` around the fixed lifecycle.
Metrics were not available where data loading originally belonged, so we moved
loading into the measured workload phase and guarded it with a process-wide
once barrier. Live load throughput needed background samplers outside the model.

None of these workarounds was individually fatal. Together they meant that a
small feature often required coordinated changes in Go, TypeScript, generated
bindings, the runner, fake probe surfaces, environment bridges, and k6 options.
We were paying an adoption cost at almost every boundary.

## The performance boundary

Sobek is an interpreter without a JIT. That is reasonable for portable load-test
scripts, but Stroppy's CPU-heavy work included generating millions of TPC rows,
binding query arguments, selecting transaction data, and recording several
metrics per operation.

We had already moved the expensive generation paths into Go. The TypeScript
layer increasingly composed calls into exported Go functions, which meant every
hot operation crossed the runtime boundary without gaining much flexibility.
The metric path had a similar cost: samples moved through k6's general-purpose
pipeline even though Stroppy needed a bounded set of counters and histograms.

The native engine did not need to make Go faster than JavaScript in the abstract.
It only needed to stop translating synchronous Go database work through a script
host and a generic sample stream.

## A framework-only v5 versus v6 measurement

We measured official v5.7.3 and v6.0.0 macOS arm64 release binaries on the same
Apple M5 Pro machine (18 cores, 48 GB RAM). We fixed `GOMAXPROCS=8` and ran
`tpcb/tx` through the Noop driver with setup excluded.

Each iteration performed the same transaction shape: five driver query calls,
one row read, transaction bookkeeping, workload random draws, and metrics. No
database or network was involved. This isolates framework overhead; it is not a
database benchmark.

For each version and VU count we ran five 10-second samples, alternated version
order, set logging to error, redirected terminal output, and used the median
completed iterations divided by the requested measurement window.

```bash
# v5.7.3
LOG_LEVEL=ERROR GOMAXPROCS=8 stroppy-v5 run tpcb/tx -d noop \
  -e SCALE_FACTOR=1 -e VUS=1 -e DURATION=10s \
  --steps workload

# v6.0.0
LOG_LEVEL=error GOMAXPROCS=8 stroppy-v6 run tpcb/tx -d noop \
  --scale-factor 1 \
  --executor constant-vus --vus 1 --duration 10s \
  --steps workload
```

| VUs | v5.7.3 median tx/s | v5 range | v6.0.0 median tx/s | v6 range | Ratio |
|---:|---:|---:|---:|---:|---:|
| 1 | 8,363 | 8,159–8,663 | 371,032 | 345,924–377,976 | 44.4× |
| 8 | 34,709 | 34,189–34,854 | 702,827 | 692,542–721,113 | 20.2× |

The gap is large because this case deliberately removes database latency. A real
TPC-C run against a database will not become 20–44 times faster: network
round-trips, locks, storage, query execution, and server capacity dominate long
before the client reaches these rates.

The result still matters. It gives us more headroom before the load generator
becomes the bottleneck, and it makes tiny/loopback operations less distorted by
the harness.

The scaling result also shows unfinished work. V5 scaled 4.15× from one to eight
VUs; v6 scaled 1.89×. V6 remained much faster in absolute terms, but its native
OpenTelemetry metric pipeline contends at very high iteration rates. We expose
that ceiling in `stroppy baseline` rather than treating it as a machine fault.
The migration removed one bottleneck and made the next one visible.

The uncompressed release binary also moved from 74.2 MB in v5.7.3 to 38.8 MB in
v6.0.0, a 47.7% reduction, even though the v6 binary embeds the pg-noop server
used by the baseline command.

## What we built instead

The first proof-of-concept RFC explored a broad native SDK: a step DAG, open and
closed executors, per-VU metric shards, prepared handles, and independently
runnable Go tests. The migration decision survived the prototype, but we did not
ship that whole design.

The released v6 engine is narrower:

- registered Go workloads with `Define`, `Setup`, `Iterate`, and `Teardown`;
- shared-iterations and constant-VU executors;
- typed CLI/config/environment resolution;
- named workload steps and SQL assets;
- typed batch sources and driver insert requests;
- OpenTelemetry counters, gauges, and fixed-bucket histograms;
- direct workload and driver registries.

Porting every built-in workload changed our view of what was necessary. We kept
the small execution model that covered current workloads and left DAG/open-loop
work for a concrete future need.

## What we gave up

Removing k6 also removed real capabilities. V6 does not execute arbitrary
TypeScript workloads, use k6 outputs, export the k6 HTML dashboard, or inherit
the wider k6 extension ecosystem. A custom executable workload now needs Go
source, registration, and a rebuilt binary.

We accepted that trade because our maintained workloads were already mostly Go
behind a TypeScript composition layer. We retained direct `.sql` files, inline
SQL, local dialect overrides, typed JSON configuration, and environment
compatibility for existing automation. We also kept v5 documentation available
for scripts that still depend on the old runtime.

## The decision in one sentence

K6 gave Stroppy more machinery than we used, while the parts we did use required
increasingly painful adaptation and imposed a measurable hot-path cost.

A native engine made Stroppy's actual model explicit: synchronous database work,
deterministic generation, a small executor, direct metrics, and drivers in the
same runtime. V6 is not the end of that work, but it is a base we can reason
about without maintaining two versions of every concept.

- [Stroppy v6.0.0 release](https://github.com/stroppy-io/stroppy/releases/tag/v6.0.0)
- [V6 release highlights](/blog/stroppy-v6-release)
- [Migrating to v6](/docs/migration-v6)
- [Machine baseline](/docs/baseline)
- [Original native-engine RFC](https://github.com/stroppy-io/stroppy/blob/44f6bc2b75a266825b8c8f857fbbe0ccf7b8d810/next/docs/rfc/0001-engine.md)
