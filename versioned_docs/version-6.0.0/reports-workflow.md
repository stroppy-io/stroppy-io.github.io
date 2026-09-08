---
sidebar_position: 10
title: Reports & Workflow
description: Native summaries, error reporting, OpenTelemetry export, and repeatable benchmark workflow
---

# Reports & Workflow

Stroppy v6 records metrics with OpenTelemetry instruments inside the Go engine.
Every run prints a terminal summary; optional OTLP export sends the same
measurements to a collector.

## Terminal summary

At shutdown Stroppy collects counters, gauges, and fixed-bucket histograms:

```text
=== bench summary ===
  iterations_total                         100.000
  transactions_total                       100.000
  run_query_operations_total               500.000
  run_query_duration                       count=500 avg=1.240 p(50)~=1.000 p(90)~=2.500 p(95)~=2.500 p(99)~=5.000
  tx_total_duration                        count=100 avg=7.310 p(50)~=5.000 p(90)~=10.000 p(95)~=10.000 p(99)~=25.000
```

Histogram percentiles are approximations from fixed buckets. Duration
histograms use milliseconds and include buckets from 5 microseconds through 60
seconds. This keeps memory bounded during long high-throughput runs.

## Core metrics

| Metric | Instrument | Meaning |
|---|---|---|
| `iterations_total` | counter | Completed iterations. |
| `iteration_duration` | histogram | End-to-end iteration duration in ms. |
| `transactions_total` | counter | Transactions observed. |
| `tx_total_duration` | histogram | Transaction wall time in ms. |
| `tx_commits_total` | counter | Successful commits. |
| `tx_errors_total` | counter | Transaction errors. |
| `tx_queries_per_tx` | histogram | Queries per transaction. |
| `run_query_operations_total` | counter | Query operations. |
| `run_query_errors_total` | counter | Query errors. |
| `run_query_duration` | histogram | Query execution time in ms. |
| `insert_operations_total` | counter | Insert requests. |
| `insert_errors_total` | counter | Failed insert requests. |
| `insert_duration` | histogram | Insert duration in ms. |
| `insert_rows_total` | counter | Loaded rows. |
| `insert_progress_rows_total` | counter | Rows reported by progress events. |
| `insert_progress_rows_per_second` | gauge | Current progress throughput. |
| `terminal_errors_total` | counter | Terminal nonfatal workload errors. |
| `failed_iterations_total` | counter | Iterations ending in terminal error. |
| `failed_queries_total` | counter | Query-set operations ending in error. |
| `retry_attempts_total` | counter | Scheduled retries. |

Workloads add their own instruments. TPC-C, for example, records transaction
counts, per-type duration histograms, mix decisions, remote selections, rollback
checks, and retries. TPC-H records duration, run, error, and elapsed-total
metrics for q1 through q22.

## Completed-with-errors summary

Nonfatal terminal transaction and query-set errors do not stop remaining work.
When any occur, final output adds:

```text
=== bench completed with errors ===
  terminal_errors_total                    3
  failed_iterations_total                  1
  failed_queries_total                     2
  retry_attempts_total                     4
  representative error groups:
    operation=...          class=...       count=...
```

Warnings are bounded by operation/error-class group; repeated failures are
reported periodically instead of flooding logs.

A nonfatal completed-with-errors run exits `0`. Automation requiring a clean
benchmark should gate on `terminal_errors_total`, failed counters, or the final
marker. Structural setup/validation/teardown/fatal failures remain nonzero.

## Workload reports

TPC-C prints a workload-specific text report after every run. JSON is also
available to programmatic callers inside the Go workload package. It includes:

- count, mix, and throughput per transaction type;
- p50/p90/p95/p99 response times;
- retry and required rollback/remote-choice observations;
- TPC-C §5.2.5 response-time and mix verdicts for paced runs;
- statistical-validity and steady-state status.

Unpaced throughput runs mark compliance checks not applicable rather than
presenting them as specification results.

TPC-H and TPC-DS SF=1 answer comparison is diagnostic. Differences and query
errors appear in their validation summaries but do not change exit status.

## OpenTelemetry export

Configure OTLP under `global.exporter.otlpExport` in a JSON config file.

### gRPC

```json
{
  "global": {
    "exporter": {
      "name": "otlp",
      "otlpExport": {
        "otlpGrpcEndpoint": "otel-collector:4317",
        "otlpEndpointInsecure": true,
        "otlpMetricsPrefix": "stroppy_"
      }
    }
  }
}
```

### HTTP

```json
{
  "global": {
    "exporter": {
      "name": "otlp",
      "otlpExport": {
        "otlpHttpEndpoint": "otel-collector:4318",
        "otlpHttpExporterUrlPath": "/v1/metrics",
        "otlpHeaders": "authorization=Bearer token",
        "otlpEndpointInsecure": true
      }
    }
  }
}
```

Endpoint fields use `host:port` without a URL scheme. If both endpoints are
configured, gRPC wins. Default metric prefix is `stroppy_`; default HTTP path
is `/v1/metrics`.

`OTEL_METRIC_EXPORT_INTERVAL` sets export cadence in milliseconds; default is
10000.

Resource attributes include `service.name=stroppy`, release version,
`stroppy.run.id` when configured, and every entry from `global.metadata`.
Core metric attributes include:

```text
step
table_name
method
event
row_kind
tx_name
tx_isolation
tx_action
operation
error_class
```

Attribute cardinality is bounded. Excess unseen tag combinations collapse into
an overflow series.

## Grafana dashboard

Stroppy ships a dashboard for the v6 metric model:

- [dashboard.json at v6.0.0](https://github.com/stroppy-io/stroppy/blob/v6.0.0/docs/dashboard.json)

Import it into Grafana and point panels at metrics received from your OTLP
collector/export path. The collector exposes `service.name` as `job` in the
reference integration setup. Add a `scenario` entry under `global.metadata` if
you want to use the dashboard's scenario filter:

```json
{"global": {"metadata": {"scenario": "tpcc"}}}
```

V6 does not emit the old client byte counters, so dashboard network panels stay
empty. Load, query, transaction, error, and progress panels use current native
metrics.

## Repeatable benchmark workflow

### 1. Record environment

Pin:

- Stroppy version;
- workload, SQL variant, scale, and seed;
- database version/configuration;
- machine placement and hardware;
- executor, VUs, duration/iterations;
- driver pool and load workers.

Save repeatable inputs in JSON:

```json
{
  "script": "tpcc/tx",
  "drivers": {
    "0": {
      "driverType": "postgres",
      "url": "postgres://bench:bench@db:5432/tpcc",
      "pool": {"maxConns": 64}
    }
  },
  "run": {
    "executor": "constant-vus",
    "vus": 64,
    "duration": "10m"
  },
  "params": {
    "scaleFactor": 50,
    "loadWorkers": 16
  }
}
```

### 2. Separate load and measurement

```bash
stroppy run -f benchmark.json --no-steps workload
stroppy run -f benchmark.json --steps workload
```

This removes schema/load time from workload throughput. Keep loaded data and
configuration identical between comparisons.

### 3. Warm and repeat

Run enough repetitions to distinguish change from noise. Record medians and
distributions, not one best result. Keep database cache state intentional and
consistent.

### 4. Inspect errors before performance

A high throughput number is invalid when terminal errors, failed queries,
failed iterations, or unexpected retries differ between runs. Compare error
summary first.

### 5. Correlate server telemetry

Use database and host metrics alongside Stroppy measurements. A client-side
latency change can originate in connection pooling, query count, network,
database CPU, I/O, locks, or plan changes.

## Measure Stroppy overhead

Run [Machine Baseline](./baseline) on each load-generator host:

```bash
stroppy baseline
```

The wire tier gives a client-side ceiling for comparison with real database
runs. Saved JSON history tracks machine-local changes across Stroppy versions.

## CI usage

A strict smoke job should fail on command exit, error logs, and the nonfatal
summary marker:

```bash
set -o pipefail
stroppy run tpcb/tx -f smoke.json 2>&1 | tee stroppy.log
! grep -q 'bench completed with errors' stroppy.log
```

For production performance gates, export OTLP and compare stable aggregate
windows on dedicated runners. Avoid hard absolute thresholds across unrelated
hardware.
