---
title: Changelog
description: Changes in Stroppy 6.0.0.
---

Changes in 6.0.0, since the previous documented release (5.7.0).

## [6.0.0] - 2026-09-08

### Added

- New `stroppy baseline` command measures stroppy's own performance ceiling on the current machine without a database: a noop-driver framework tier and a pg-wire protocol tier against the pg-noop blackhole server, each reporting load throughput plus single-VU and parallel transaction rates. Verdicts check hardware-independent invariants (parallel scaling, loopback latency floor, measurement sanity), every run saves a versioned JSON report under `~/.stroppy/baselines/` with a delta versus the previous run, and the pg-noop server ships embedded in release builds or downloads with consent (sha256-verified) otherwise. ([#162](https://github.com/stroppy-io/stroppy/pull/162))
- `--query-timeout` (also `QUERY_TIMEOUT` and config `run.queryTimeout`) bounds each executed statement with a per-statement deadline; `0` (the default) disables it. Timed-out statements are reported distinctly from a canceled run, and MySQL adds a server-side `MAX_EXECUTION_TIME` hint so a timed-out query keeps its pooled connection. ([#153](https://github.com/stroppy-io/stroppy/pull/153))
- All TPC-C runs now emit text and JSON reports with per-transaction count, mix, throughput, and p50/p90/p95/p99 response times; paced runs additionally receive §5.2.5 response-time and transaction-mix verdicts, statistical-validity status, and a steady-state assessment, while unpaced runs mark compliance not applicable. ([#147](https://github.com/stroppy-io/stroppy/pull/147))
- Restored the `tpcb/procs` workload: TPC-B ships both `tx` and `procs` variants again, with `tpcb/procs` running each transaction as one server-side stored-procedure call (`tpcb_transaction`) on PostgreSQL and MySQL. ([#146](https://github.com/stroppy-io/stroppy/pull/146))
- `stroppy probe` now lists registered workload parameter flags, and its JSON output includes each workload's typed schema for tooling and discovery. ([#128](https://github.com/stroppy-io/stroppy/pull/128))
- Typed scenario and workload parameters can be set with `--name` flags or native JSON values in the config file's `run` and `params` objects, and `stroppy run <workload> --help` lists the available parameters. ([#128](https://github.com/stroppy-io/stroppy/pull/128))
- Go workloads can declare typed string, boolean, numeric, and duration parameters with defaults, descriptions, source tracking, and discoverable schemas. ([#128](https://github.com/stroppy-io/stroppy/pull/128))
- Database errors are classified by each driver into shared facts, and Go workloads can override the default retry, error, ignore, or fatal action for each fact without matching backend-specific codes or messages. ([#127](https://github.com/stroppy-io/stroppy/pull/127))
- Reusable generation primitives now live in `pkg/gen`, while `pkg/datagen/source` defines the row-production seam and `pkg/datagen/tpchgen` and `pkg/datagen/tpcdsgen` adapt the canonical TPC-H and TPC-DS generators. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- `pkg/gen` now provides typed direct-output batches: a reusable columnar [Batch] with bound [Column] handles and an [IndexedSource] that fills rows through a plain Go row callback, so workload formulas write straight into prepared storage with zero generation-time allocations after preparation. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- Insert-method ownership moves to the driver package: `driver.InsertMethod` is the Go-native enum for the typed insert path, with `ParseInsertMethod` for authoring strings (`plain_query`, `plain_bulk`, `columnar`, `native`). ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- Typed insert path: `driver.InsertRequest` + `Driver.Insert` + `Bench.Insert` stream rows from a workload-authored `gen.BatchSource` through every driver (postgres, mysql, picodata, ydb, noop, csv), with a typed parallel runner in `pkg/driver/common`. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- The `simple` workload loads `stroppy_demo` through the typed insert path: a plain Go row formula (id, 8-char label, uniform value) over a versioned `gen` source replaces the relational InsertSpec struct literal. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- TPC-B loads `pgbench_branches`, `pgbench_tellers`, and `pgbench_accounts` through the typed insert path: per-table `gen` sources preserve the bid fan-out arithmetic (`floor(entity/perBranch)+1`), fixed-width ASCII fillers, and the legacy per-table seeds. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- TPC-C loads all eight tables (`warehouse`, `district`, `customer`, `item`, `stock`, `orders`, `order_line`, `new_order`) through typed plain-Go sources, preserving NURand surnames, per-district customer permutations, fixed-width fields, decimal scales, credit and delivery splits, and ORIGINAL markers. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- TPC-H loads through the typed insert path: all eight tables (`region`, `nation`, `part`, `supplier`, `partsupp`, `customer`, `orders`, `lineitem`) stream from the canonical dbgen generator through `pkg/datagen/tpchgen` and `gen.BatchSource`. Canonical seeds, partition seeking, entity fan-out, and SF=1 output are unchanged; dbgen's `Make*` layer remains the documented internal allocation boundary. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- TPC-DS loads through the typed insert path: all 24 tables (18 dimension tables, inventory, and 6 fan-out sales/returns fact tables) stream from the canonical dsdgen generator through `pkg/datagen/tpcdsgen` and `gen.BatchSource`, preserving text output, null semantics, ticket fan-out, partition seeking, and nominal fact-row reporting. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- The legacy `InsertSpec` load path is gone. `Driver.InsertSpec`, `Bench.InsertSpec`, `loadsource.Build`, the per-driver `InsertSpec` methods, `RunParallelByWorkers`, and the dgproto↔driver `MethodFromProto`/`MethodToProto` boundary converters are removed; every workload now loads exclusively through the typed `driver.Insert`/`Bench.Insert` path over `gen.BatchSource`. The shared `Chunk`/`SplitChunks` helpers moved to `pkg/driver/common/chunks.go`; per-driver `runInsertChunk`/bulk/COPY helpers are unchanged. Insert-method strings (`plain_query`, `plain_bulk`, `columnar`, `native`), probe output, and progress/metrics semantics are preserved. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- Metrics can again be exported to an OpenTelemetry collector through the existing `global.exporter.otlpExport` gRPC or HTTP configuration. ([#125](https://github.com/stroppy-io/stroppy/pull/125))

### Changed

- Benchmark duration histograms add sub-100µs buckets (5–50µs) so loopback-scale latencies are no longer clamped to the coarsest 100µs bucket. ([#162](https://github.com/stroppy-io/stroppy/pull/162))
- Nonfatal transaction and query-set errors now keep virtual users running, exit successfully, and appear in bounded warnings, terminal-error metrics, and a prominent final summary; the unused driver `errorMode` option has been removed and is now rejected. ([#156](https://github.com/stroppy-io/stroppy/pull/156))
- Logging now uses one safely replaceable process-wide logger, with configurable level and output mode precedence plus redacted database connection diagnostics. ([#154](https://github.com/stroppy-io/stroppy/pull/154))
- Driver insert-method defaults now fill only load requests that leave their method unset, preserving methods selected by workloads. ([#152](https://github.com/stroppy-io/stroppy/pull/152))
- SIGINT and SIGTERM now cancel the running workload and trigger graceful teardown; a second signal forces immediate exit. Exit status is 130 (SIGINT) or 143 (SIGTERM) after a graceful cancellation, 2 after a forced exit, and 1 for other errors. ([#148](https://github.com/stroppy-io/stroppy/pull/148))
- Built-in workloads expose their tuning options as typed parameters while preserving the existing environment-variable names. ([#128](https://github.com/stroppy-io/stroppy/pull/128))
- TPC-DS typed loads format common cell types directly into reusable buffers. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- Benchmark metrics now use standard OpenTelemetry counters, gauges, and fixed-bucket histograms. Query throughput and error rates are derived from monotonic `*_total` counters instead of k6-style sampled rates. ([#125](https://github.com/stroppy-io/stroppy/pull/125))
- The `stroppy help <topic>` topics (drivers, config-file, steps, resolution, sql, envs, datagen, probe) now describe the Go-native binary — the previous text still documented the removed TypeScript/k6 workflow (`k6Args`, `declareDriverSetup`, `.ts` script mode, the `--` passthrough).
- Stroppy configuration is now plain Go under `pkg/config` instead of frozen application protobuf types. Existing v5 lower-camel and snake_case JSON field names, nullable fields, int32 number forms, and logger enum names/ordinals remain compatible, while duplicate, colliding, mis-cased, unknown, malformed, and trailing input is rejected recursively across config files and raw driver JSON. `global.seed` is the sole accepted-form change and now requires a bare unsigned JSON integer. The generated schema documents the complete `stroppy-config.json` envelope, including `run.queryTimeout` and workload parameters. ([#150](https://github.com/stroppy-io/stroppy/pull/150))
- Inputs now resolve once through typed parameters and pass directly to workloads and drivers instead of using process-environment bridges for step filters, execute-SQL sources, pool sizing, CSV workload identity, or serialized driver config. Process environment variables remain supported as typed input sources, space-separated `--sql-body` accepts query text beginning with a `--= name` marker, and SQL sources without named queries report a source-neutral error. The historical `k6Args`, `k6Config`, and driver `defaultTxIsolation` fields are now rejected as unknown; use typed executor settings and each workload's `--tx-isolation` parameter instead. ([#151](https://github.com/stroppy-io/stroppy/pull/151))

### Fixed

- Unknown run flags and arguments after `--` now point to workload help and supported typed flags instead of recommending a removed passthrough. ([#164](https://github.com/stroppy-io/stroppy/pull/164))
- Baseline runs now reject empty measurements and invalid negative inputs, isolate concurrent benchmark state, cancel and bound pg-noop downloads, use target-specific authoritative server caches, verify embedded release assets against Stroppy-pinned checksums, and preserve report output and history integrity. ([#162](https://github.com/stroppy-io/stroppy/pull/162))
- CSV output now publishes shards, merged files, and manifests atomically across fresh and repeated loads, so canceled or failed loads retain recoverable shards and never expose partial output as complete. ([#157](https://github.com/stroppy-io/stroppy/pull/157))
- Query helpers now return an empty result instead of panicking when a driver supplies no result set, and query timeouts that surface while closing result sets are reported once instead of repeating the same error. ([#153](https://github.com/stroppy-io/stroppy/pull/153))
- Empty, whitespace-only, or comma-only step filters no longer conflict with a real opposite filter; `--steps=` still clears configured steps before `--no-steps` is applied. ([#149](https://github.com/stroppy-io/stroppy/pull/149))
- The `workload` step is silent on the console again (no `Start`/`End` record per transaction), while setup/load/schema steps still log a single start/end and the `simple` workload now honors `--steps`/`--no-steps` like the other workloads. ([#149](https://github.com/stroppy-io/stroppy/pull/149))
- `--steps` and `--no-steps` are rejected as mutually exclusive even when one is set in the config file and the other on the command line. ([#149](https://github.com/stroppy-io/stroppy/pull/149))
- TPC-B fails fast with a named missing query/section instead of running a silent noop iteration when a custom SQL file omits required statements. ([#145](https://github.com/stroppy-io/stroppy/pull/145))
- TPC-C treats absent customer, warehouse, item, and stock rows as transaction errors, propagates rollback failures instead of reporting an unknown outcome as success, and fails population-validation checks whose aggregate queries error. ([#145](https://github.com/stroppy-io/stroppy/pull/145))
- `stroppy version` now reports the real build version for Docker images (pushed tag), nightly artifacts (`nightly-<short-sha>`), and release archives (release tag), instead of the generic `0.0.0` fallback. ([#144](https://github.com/stroppy-io/stroppy/pull/144))
- Workload help and shell completion expose typed flags accurately, including explicit booleans and contextual defaults, and SQL override positionals reach registered workload bindings. ([#128](https://github.com/stroppy-io/stroppy/pull/128))
- Typed run parameters and SQL sources keep CLI-over-environment precedence, config env names reject case-only collisions, shared driver pool settings remain active alongside driver-specific settings, and invalid pool fields fail clearly instead of being ignored. ([#128](https://github.com/stroppy-io/stroppy/pull/128))
- Typed inserts reject malformed requests consistently, and generator ranges remain correct at integer boundaries. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- Long high-throughput workloads keep bounded metric memory instead of retaining every latency observation until the final summary. ([#125](https://github.com/stroppy-io/stroppy/pull/125))

### Removed

- The relational data-generation expression framework is gone. `pkg/datagen/{compile,expr,runtime,lookup,cohort,stdlib,seed}` and the frozen `pkg/datagen/dgproto` protobuf types (InsertSpec, Expr, StreamDraw, …) are deleted. Reusable generation primitives now live in `pkg/gen`; `pkg/datagen/source` is the row-production seam, and `pkg/datagen/tpchgen` and `pkg/datagen/tpcdsgen` adapt the surviving canonical generators. The `datagen-framework.md` and `proto.md` guides were removed — `docs/parallelism.md` is the load-parallelism reference. ([#126](https://github.com/stroppy-io/stroppy/pull/126))
- Stroppy no longer depends on k6, TypeScript, sobek, esbuild, or node/npm. The engine is now a single plain Go binary built with `go build` — authoring benchmarks in TypeScript, the `--` k6-args passthrough, the `gen` scaffolding command, and the cloud status gRPC service are all gone. Configure runs primarily with `--executor`, `--vus`, `--iterations`, `--duration`, and `--query-timeout`, or the matching typed `run` config fields; environment variables remain compatibility inputs. Workloads are Go-native (`tpcc/tx`, `tpcb/tx`, `tpch/tx`, `tpcds`, `simple`, `execute_sql`); `.sql` files and inline SQL still work.

## [5.7.3] - 2026-07-29

### Fixed

- `PACING=true` now applies keying and think-time delays to `tpcc/procs` as well as `tpcc/tx`. The pacing code lived only in the `tx` variant, so stored-procedure runs ignored it entirely and ran unpaced regardless of the flag. ([#114](https://github.com/stroppy-io/stroppy/pull/114))

### Changed

- The `tpcc/tx` and `tpcc/procs` workloads now share their driver setup, load/prepare lifecycle, retry policy, pacing, weighted dispatch, and post-run summary through `tpcc_common.ts` (matching the existing `tpcb` layout), instead of each carrying its own copy. Both variants now surface database errors as exceptions consistently (previously `procs` threw while `tx` only logged). ([#114](https://github.com/stroppy-io/stroppy/pull/114))

## [5.7.2] - 2026-07-27

### Changed

- PostgreSQL data loads now keep tables `LOGGED` by default instead of flipping them to `UNLOGGED` for the bulk load. The `UNLOGGED` optimization (WAL-free load, then flip back) is now opt-in via `-e PG_UNLOGGED=true`. It traded load speed for a sharp footgun: a `prepare` that ran twice on the same schema failed with `could not change table "warehouse" to unlogged because it references logged table "district" (42P16)`, because the foreign keys added at the end of the first prepare block the unlogged flip at the start of the second — so re-running a workload without dropping the schema aborted every iteration. Logged-by-default removes that failure mode entirely. ([#111](https://github.com/stroppy-io/stroppy/pull/111))
- Stroppy allocates far less memory in the hot transaction loop. Every reference to a named import (`Step`, `ENV`, `Rel`, `Draw`, `retry`, `DriverX`, …) had k6 rebuild the full module exports table from scratch, which a 30s heap profile showed as the single largest allocator. The exports table is now built once per VU and reused, cutting that churn entirely. ([#110](https://github.com/stroppy-io/stroppy/pull/110))

## [5.7.1] - 2026-07-23

### Changed

- Stroppy runs scale better at high VU counts. A single shared mutex guarded the active-step tag and was write-locked on every `Step()` plus read on every metric sample, so all VUs serialized on it — a 30s CPU profile of a `tpcb` run showed ~940 of ~1000 goroutines parked waiting for it while the database sat idle. The step tag now lives per-VU (lock-free), and the per-transaction metrics snapshot path no longer takes a mutex (pointers are immutable after one-time registration). Microbenchmarks of both paths drop ~140 ns/op to under 1 ns/op at 8 cores. ([#109](https://github.com/stroppy-io/stroppy/pull/109))

### Fixed

- TPC-B transactions now retry on serialization conflicts instead of failing the run. The `tpcb/tx` workload issued its transaction with no retry wrapper, so under concurrent VUs the first serializable abort — PostgreSQL `40001`/`40P01`, MySQL `1213`, or YDB `Transaction locks invalidated` — was thrown straight to the error log and aborted the whole run, even though every other transactional workload (tpcc/tpch/tpcds) already retries these. tpcb now applies the same retry policy, so transient contention is replayed instead of surfaced (visible as the new `tpcb_retry_attempts` counter). ([#108](https://github.com/stroppy-io/stroppy/pull/108))
