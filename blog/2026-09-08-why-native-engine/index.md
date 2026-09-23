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

## Measuring more than one ceiling

A framework-only test can show the cost of the harness, but not the speedup a
database workload will see. We therefore measured three different boundaries
with the official v5.7.3 and v6.0.0 Linux amd64 release binaries:

- TPC-B through the Noop driver, for framework overhead and scaling;
- TPC-C against PostgreSQL, for a real multi-statement transaction mix;
- TPC-H through the Noop driver, for canonical data generation and row transport.

The host was an Ubuntu 24.04 KVM guest with an AMD EPYC Genoa CPU, 48 vCPUs
presented as 24 cores with two threads per core, and 47 GiB of RAM. Primary
measurements used one hardware thread from each guest-visible core. We pinned
client and database processes to disjoint CPU sets, alternated version order,
kept every sample, and report medians with full ranges. Unless noted otherwise,
each point contains five runs. The VM reported no steal time during measured
runs.

### Framework overhead

The TPC-B Noop case excludes setup, network, and database work. Each iteration
performs five driver calls, one row read, transaction bookkeeping, random draws,
and metrics. With `GOMAXPROCS=24`, five 20-second samples produced:

| VUs | v5.7.3 median tx/s | v5 range | v6.0.0 median tx/s | v6 range | Ratio |
|---:|---:|---:|---:|---:|---:|
| 1 | 4,368 | 4,354–4,404 | 145,524 | 144,643–146,318 | 33.3× |
| 2 | 8,261 | 8,211–8,319 | 203,091 | 201,134–203,866 | 24.6× |
| 4 | 15,298 | 15,244–15,509 | 311,432 | 292,591–313,606 | 20.4× |
| 8 | 26,409 | 26,147–26,533 | 443,443 | 427,692–449,184 | 16.8× |
| 16 | 37,649 | 37,444–37,935 | 500,772 | 488,983–506,892 | 13.3× |
| 24 | 38,694 | 38,296–38,789 | 517,627 | 501,589–525,519 | 13.4× |

V5 scaled 8.86× from one to 24 VUs; v6 scaled 3.56×. V6 remained much faster in
absolute terms, but its native OpenTelemetry metric pipeline became the next
bottleneck. Enabling all 48 SMT threads reduced v6 throughput rather than
increasing it, so we do not present this VM as a 48-core machine.

### Real TPC-C transactions

The framework result is a ceiling, not a database claim. For a representative
transactional test, we loaded 16 TPC-C warehouses into PostgreSQL 16.15 and ran
the standard 45/43/4/4/4 transaction mix. PostgreSQL used eight pinned cores;
Stroppy used 16 different cores with `GOMAXPROCS=16`. Each point contains five
alternating 20-second samples with no terminal iteration failures.

| VUs | v5.7.3 median tx/s | v5 range | v6.0.0 median tx/s | v6 range | Ratio |
|---:|---:|---:|---:|---:|---:|
| 1 | 202 | 199–203 | 290 | 277–291 | 1.44× |
| 8 | 1,610 | 1,608–1,625 | 2,203 | 2,181–2,248 | 1.37× |
| 16 | 2,892 | 2,862–2,899 | 3,368 | 3,204–3,394 | 1.16× |

This is the practical boundary the Noop result cannot supply. The native engine
still improved throughput, especially at low concurrency where client overhead
is more visible, but PostgreSQL execution, locking, and round-trips increasingly
dominated as concurrency rose. Peak process RSS also fell from 309–597 MiB in
v5 to 38–45 MiB in v6 across these runs.

### TPC-H generation and load transport

TPC-H answers a different question. Its canonical dbgen implementation and the
`tpchgen.go` projection code are byte-identical in the two release tags; seeds,
cardinalities, seeking, fan-out, and generated values did not change. V6 changed
the transport around that generator: the same rows now pass through reusable
typed columnar batches and `InsertRequest` instead of the legacy `[]any`
row-source path.

We generated and drained all 8,660,030 SF=1 rows through the Noop driver with
`GOMAXPROCS=24`:

| Workers | v5.7.3 median rows/s | v5 range | v6.0.0 median rows/s | v6 range | Ratio |
|---:|---:|---:|---:|---:|---:|
| 1 | 473,743 | 469,633–477,400 | 429,992 | 427,234–433,002 | 0.91× |
| 2 | 658,057 | 653,094–661,576 | 656,063 | 646,754–664,622 | 1.00× |
| 4 | 820,079 | 795,959–838,338 | 901,148 | 891,867–911,582 | 1.10× |
| 8 | 934,200 | 906,809–948,525 | 1,108,840 | 1,081,150–1,121,770 | 1.19× |
| 16 | 953,748 | 946,451–971,945 | 1,237,150 | 1,207,810–1,275,410 | 1.30× |
| 24 | 940,286 | 927,198–964,369 | 1,258,730 | 1,249,640–1,318,120 | 1.34× |

Typed batching added slight single-worker overhead and was neutral at two
workers, but scaled better from four workers onward. At 24 workers it delivered
34% more rows per second. Peak RSS fell by about 18%, from roughly 1.46 GiB to
1.20 GiB. This is a load-pipeline improvement, not a claim that v6 changed or
made the TPC-H data formulas faster.

Together the three measurements set the right scope. Removing k6 increased
framework headroom by 13–33×, improved real PostgreSQL TPC-C throughput by
16–44%, and improved parallel TPC-H generation-and-drain throughput by up to
34%. Gains depend on where work is spent; no single multiplier describes every
workload.

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
