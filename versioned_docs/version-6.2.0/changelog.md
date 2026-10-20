---
title: Changelog
description: Changes in Stroppy 6.2.0.
---

Changes in 6.2.0, since the previous documented release (6.0.0).

## [6.2.0] - 2026-10-20

### Added

- Saved runs can be compared with `stroppy reports compare` or catalog selection, with shared numeric deltas, configuration differences, script-free comparison HTML, and aligned captured metric timelines. ([#210](https://github.com/stroppy-io/stroppy/pull/210))
- Runs can optionally record timestamped metrics and structured logs with independent `--capture-metrics` and `--capture-logs` flags; rich reports show timelines, phase events, and searchable, expandable logs, and `reports artifact` / `reports bundle` retrieve complete recordings with report-owned cleanup. ([#209](https://github.com/stroppy-io/stroppy/pull/209))
- Saved runs can be browsed with `stroppy reports serve` or exported as self-contained HTML with `stroppy reports export` and `--report-html`; generic metrics, custom results, charts, and full report identity remain readable without JavaScript. ([#203](https://github.com/stroppy-io/stroppy/pull/203))
- `stroppy reports` lists and filters saved runs, retrieves complete JSON, previews or removes reports, and shows storage health; `--no-save-report` disables history for one run without disabling report output. ([#199](https://github.com/stroppy-io/stroppy/pull/199))
- `banking` moves money between accounts and checks that total balances and the token permutation are preserved; token checks detect partial swaps, not whole transfers that are lost or repeated, and are unavailable on Picodata. An optional `banking/inject` variant exercises PostgreSQL commit failures through Macavity. See the verification limitation below. ([#205](https://github.com/stroppy-io/stroppy/pull/205))
- `crdb`, `yugabyte` and `tidb` are driver names of their own: each speaks another's protocol (postgres, postgres, mysql) but selects its own SQL asset and transaction defaults, so `-d crdb` replaces the `--sql-file crdb.sql` that was documented and could never work — that flag takes a filesystem path, not an embedded asset. TPC-H could not run on CockroachDB at all before, and now ships the `crdb.sql` it needed. ([#206](https://github.com/stroppy-io/stroppy/pull/206))
- TPC-C can spread each VU's transactions across all configured warehouses with `--spread-warehouses`, independently of concurrency. ([#195](https://github.com/stroppy-io/stroppy/pull/195))
- TPC-C supports optional `--warmup` traffic before measurement, using existing `step=warmup` and `step=workload` metric labels. ([#195](https://github.com/stroppy-io/stroppy/pull/195))
- `stroppy build`, `stroppy remove`, and `stroppy export` accept `--source-root PATH` (or `STROPPY_SOURCE_ROOT`) to compile local artifacts against a Stroppy source tree instead of the pinned SDK module, and every build states which SDK the activated runtime uses, including the effective module version when a workload pins a newer one. ([#191](https://github.com/stroppy-io/stroppy/pull/191))
- `stroppy init` creates a minimal standalone Go workload, and `stroppy eject` restores explicitly published workload source into a new or empty directory, including built-in sources and exported collections. ([#188](https://github.com/stroppy-io/stroppy/pull/188))
- Workload tests can use public noop/recording helpers and a recording driver that captures typed query arguments, transactions, and inserts without a database. ([#188](https://github.com/stroppy-io/stroppy/pull/188))
- Selected-workload probe can show resolved values, sources, aliases, constraints, steps, and metric schemas without running actions or connecting to databases. ([#187](https://github.com/stroppy-io/stroppy/pull/187))
- Runnable Go authoring examples cover queries, transactional loading, reports, and named databases; the supported API is documented with a v6 minor-release compatibility guarantee. ([#187](https://github.com/stroppy-io/stroppy/pull/187))
- Custom workload builds and exports reuse content-addressed artifacts, preserve owned source snapshots, expose secret-free provenance through `stroppy cache inspect`, and identify generated runtime reports by build digest. ([#186](https://github.com/stroppy-io/stroppy/pull/186))
- `stroppy export` creates one portable binary containing every built-in and all or selected custom workload packages, with standard cross-compilation support and a verified private Go 1.26.8 fallback under `~/.stroppy`. ([#185](https://github.com/stroppy-io/stroppy/pull/185))
- `stroppy build`, `list`, and `remove` manage compiled custom workloads under `~/.stroppy/workloads/`, and registered workloads run or probe by name without their source tree. ([#184](https://github.com/stroppy-io/stroppy/pull/184))
- Custom Go workloads can run as standalone Stroppy applications with the standard drivers, CLI, probe, version, reports, and programmatic runtime API. ([#183](https://github.com/stroppy-io/stroppy/pull/183))
- Every constructed workload run report is saved under `~/.stroppy/reports/`; history write failures warn without failing the run. ([#183](https://github.com/stroppy-io/stroppy/pull/183))

### Changed

- Report catalogs, run views, and comparisons use Stroppy kit 0.1.0 styles, embedded fonts, and optional interactive charts while keeping offline exports, static SVG fallbacks, and JavaScript-free controls. ([#216](https://github.com/stroppy-io/stroppy/pull/216))
- Parallel workloads spend less time contending on metric updates while retaining the same public counters, histogram buckets, gauges, and sampled trace exemplars. ([#189](https://github.com/stroppy-io/stroppy/pull/189))
- Repeated SQL queries avoid allocating cache keys after warmup, and combining absent errors no longer allocates. ([#189](https://github.com/stroppy-io/stroppy/pull/189))
- `stroppy build PATH` accepts a standalone project root by checking its conventional `workload/` package when the root is not importable. ([#188](https://github.com/stroppy-io/stroppy/pull/188))
- Workload authors use ordinary test definitions and immediate named steps, with typed parameters, generic query reads, named databases, neutral metrics and reporting, and the same supported API as built-ins. ([#187](https://github.com/stroppy-io/stroppy/pull/187))
- Stroppy requires Go 1.27 and can install verified private Go 1.27.1 under `~/.stroppy`; repeated runs expose explicit drain settings and schema-3 reports record named drivers and measured step windows. ([#187](https://github.com/stroppy-io/stroppy/pull/187))
- Workload inputs use typed flags, process environment, and typed config; legacy `-e` and config `env` are rejected, and additional drivers are configured by name rather than numeric index. ([#187](https://github.com/stroppy-io/stroppy/pull/187))

- Go applications can depend on Stroppy v6 through the standard `github.com/stroppy-io/stroppy/v6` module path. ([#181](https://github.com/stroppy-io/stroppy/pull/181))

### Fixed

- Interactive report charts restore their static view when leaving the page and reinitialize when returning through the browser's back-forward cache. ([#216](https://github.com/stroppy-io/stroppy/pull/216))
- Comparison timelines scale to recorded values instead of forcing zero into the Y-axis range, making small latency changes easier to see. ([#210](https://github.com/stroppy-io/stroppy/pull/210))
- Comparison HTML export keeps selected runs and filters, metric navigation targets the right section, and stale or oversized selections no longer block catalog browsing. ([#210](https://github.com/stroppy-io/stroppy/pull/210))
- Clarified that the banking workload's token checks detect partial token swaps, not whether every transfer happened exactly once. ([#213](https://github.com/stroppy-io/stroppy/pull/213))
- The banking workload on YDB no longer fails during schema creation: its asset used `CREATE UNIQUE INDEX`, which YDB's parser refuses, where YDB requires a unique index to be declared global and synchronous. ([#212](https://github.com/stroppy-io/stroppy/pull/212))
- A rejected `COMMIT` is now counted as an ended transaction: it reaches `tx_errors_total`, and it no longer leaves the client with a spurious `tx is closed` beside the real error. Previously `tx_errors_total` under-reported exactly the runs worth measuring — a workload with commit failures showed none of them there while `failed_iterations_total` showed all of them. ([#204](https://github.com/stroppy-io/stroppy/pull/204))
- Rich-report sample links retain selected metrics and log filters, and failed capture cleanup restores the report without overwriting concurrent replacements. ([#209](https://github.com/stroppy-io/stroppy/pull/209))
- Capture retains larger execution-event bursts, and unfinished manifests omit the finish timestamp instead of showing a year-one date. ([#209](https://github.com/stroppy-io/stroppy/pull/209))
- JSON and HTML reports can use case-distinct filenames on case-sensitive filesystems, while aliases remain rejected; catalog filter controls inherit the report font correctly. ([#203](https://github.com/stroppy-io/stroppy/pull/203))
- Listing reports during concurrent saves ignores hidden publication artifacts instead of warning that partial reports are unreadable. ([#203](https://github.com/stroppy-io/stroppy/pull/203))
- Run-report failure and built-in validation diagnostics redact configured database credentials and decoded exporter headers before saving or JSON output. ([#199](https://github.com/stroppy-io/stroppy/pull/199))
- Report-history commands handle empty cleanup selections, show their own help in standalone workloads, bound oversized-report inspection, and reject files replaced after selection; saving also works without filesystem hard-link support. ([#199](https://github.com/stroppy-io/stroppy/pull/199))
- TPC-C pacing waits stop on cancellation, think once after nonfatal failures, and preserve successful transactions when post-transaction thinking is interrupted. ([#195](https://github.com/stroppy-io/stroppy/pull/195))
- TPC-C reports count successful measured completions separately from failures and drain, with phase and outcome labels on existing latency metrics. ([#195](https://github.com/stroppy-io/stroppy/pull/195))
- TPC-C transaction history IDs continue above existing data across sequential runs instead of colliding when a dataset is reused. ([#195](https://github.com/stroppy-io/stroppy/pull/195))
- Custom workload builds no longer infer the SDK source tree from the working directory, which made `stroppy build` inside a workload project replace the SDK with that project and fail. ([#191](https://github.com/stroppy-io/stroppy/pull/191))
- Selected-workload help no longer advertises the optional positional SQL file for workloads that reject it, and omits an empty "Workload parameters" section for workloads that declare none. ([#191](https://github.com/stroppy-io/stroppy/pull/191))
- `stroppy run <name> --help` prints the selected workload's parameters and steps for custom compiled workloads too, instead of reporting that the workload is unknown. ([#191](https://github.com/stroppy-io/stroppy/pull/191))
- Source ejection rejects trailing-slash symlink targets, preserves concurrently replaced directories, and relocates published self-imports without changing query data; starters reject reserved names before writing, and testkit runs honor supplied inputs while keeping every database declaration offline. ([#188](https://github.com/stroppy-io/stroppy/pull/188))
- Programmatic PostgreSQL workloads work with logging disabled, and successful runs still export explicit zero error and retry counters. ([#187](https://github.com/stroppy-io/stroppy/pull/187))
- Named databases default to native insertion, nested database facades count one logical operation, framework metric-name collisions fail before actions, concurrent logs are serialized, and row-generator panics propagate after workers and resources are cleaned up. ([#187](https://github.com/stroppy-io/stroppy/pull/187))

### Migration from 6.1.x

- Go imports now use `github.com/stroppy-io/stroppy/v6`; source builds require Go 1.27. Released binaries do not require a local Go installation for built-in workloads.
- Custom Go workloads must migrate from the former `Workload` lifecycle API to `bench.Test` definitions and immediate execution steps. See [the workload authoring API](https://github.com/stroppy-io/stroppy/blob/v6.2.0/docs/workload-authoring-api.md).
- Replace `-e key=value` and the config `env` map with typed workload/run flags, projected process environment variables, and the config `params` / `run` fields. Timed runs must explicitly select `--executor constant-vus`; `DURATION` alone no longer selects it.
- Version 6.2.0 includes these source and configuration incompatibilities; existing custom workloads and saved configurations may need migration.

### Known issues

- Banking verification can retry away an observed invariant violation if a later check succeeds; do not treat a successful banking run as conclusive corruption-test evidence until this is fixed. ([#217](https://github.com/stroppy-io/stroppy/issues/217))
- TPC-DS selects the wrong baked dialect on TiDB, and generated query streams reject TiDB/YugabyteDB engine names. Use the established MySQL/PostgreSQL driver names for these TPC-DS runs until dialect mapping is corrected. ([#218](https://github.com/stroppy-io/stroppy/issues/218))
- `tpcc/procs -d tidb` is not rejected before setup and can panic on missing procedure queries; use `tpcc/tx -d tidb` instead. ([#219](https://github.com/stroppy-io/stroppy/issues/219))

## [6.1.1] - 2026-09-28

### Added

- YDB supports `serviceAccountKeyFile` authentication with automatic IAM token management by the official Yandex Cloud credentials library; this mode requires `grpcs://` with certificate verification to protect tokens in transit. `version --json` advertises `ydb_service_account_key_file=1`. ([#173](https://github.com/stroppy-io/stroppy/pull/173))

### Fixed

- Successfully drained SQL streams no longer turn into `context canceled` errors when their per-query timeout context is released. ([#173](https://github.com/stroppy-io/stroppy/pull/173))
- Generated TPC-DS includes Q88 and rejects incomplete query sets before schema changes or data loading instead of silently skipping unsupported queries. ([#173](https://github.com/stroppy-io/stroppy/pull/173))

## [6.1.0] - 2026-09-24

### Added

- Every workload can emit one versioned JSON run report to stdout or a file, with effective inputs, host details, steps, metrics, bounded errors, and structured TPC-C, TPC-H, and TPC-DS results. ([#172](https://github.com/stroppy-io/stroppy/pull/172))
- CockroachDB SQL variants for TPC-B and TPC-C (`--sql-file tpcb/crdb.sql` or `tpcc/crdb.sql`) retain native workload metrics. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Export native transaction, iteration and query throughput over the measured workload window, including explicit zero error counters. ([#166](https://github.com/stroppy-io/stroppy/pull/166))

### Fixed

- CockroachDB TPC-C loads ignore the PostgreSQL-only unlogged option instead of issuing unsupported durability changes. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Yandex Cloud dedicated connections load the internal CA before the first IAM-token handshake; explicit credentials are never replaced by VM metadata credentials after an error. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- TPC-C population validation retries transient read failures within the configured attempt limit and reports setup retries separately; data mismatches still fail validation. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Retry YDB overload errors even when the SDK also reports cancellation of its query stream; explicit caller cancellation still stops the workload. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- TPC-C population checks now log the underlying database query error, and setup failures report zero measurement time when execution never started. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- The simple workload uses YDB-compatible table definitions and accepts unsigned row counts. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Picodata now honors pgx pool and query execution options supplied through config files or driver flags. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Picodata reads exact decimal values in text format to avoid a legacy numeric-zero decoding hang. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- TPC-C population validation handles fractional Picodata percentages without decimal encoding errors. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Retry MySQL/MariaDB snapshot conflicts (error 1020) according to the workload's serialization retry policy. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Count the final partial SQL insert batch once in load progress, keeping generated and confirmed row counts consistent. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Keep concurrent benchmark metrics distinct and preserve run metadata when exporting through OTLP to Prometheus-compatible storage. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
- Count expected TPC-C procedure rollbacks as successful logical transactions on PostgreSQL and MySQL, while preserving rollback failures. ([#166](https://github.com/stroppy-io/stroppy/pull/166))
