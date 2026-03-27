---
sidebar_position: 4
title: Reports & Workflow
description: Using k6's built-in HTML reports for iterative database development and benchmarking
---

# Reports & Workflow

Stroppy inherits k6's reporting capabilities. This page covers the built-in HTML report generation, the real-time web dashboard, and a practical workflow for iterative database benchmarking.

## k6 Web Dashboard & HTML Reports

Since k6 v0.49.0, there are two built-in reporting features that work out of the box with Stroppy:

### Real-time web dashboard

Watch your test metrics live in the browser:

```bash
K6_WEB_DASHBOARD=true stroppy run tpcc
```

This opens a web dashboard (default: `http://localhost:5665`) showing real-time graphs of:
- Request rate (queries/second)
- Response time distribution
- Active virtual users
- Custom metrics (insert duration, query duration, error rates)

### HTML report export

Generate a self-contained HTML report at the end of a test run:

```bash
K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT=reports/my-report.html \
  stroppy run tpcc
```

The HTML report includes the same detailed graphs from the dashboard, frozen at the end of the test. It's a single file &mdash; no server needed. Open it directly in any browser.

### Both at once

You can watch live and save the report simultaneously:

```bash
K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT=reports/baseline.html \
  stroppy run tpcc
```

## The Iterative Benchmarking Workflow

Here's a practical workflow for database developers: test, patch, retest, compare.

### The scenario

You're optimizing a PostgreSQL database &mdash; tuning indexes, rewriting queries, adjusting configuration. You want to measure the impact of each change with reproducible benchmarks.

### Step 1: Establish a baseline

```bash
mkdir -p reports

K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT=reports/00-baseline.html \
  stroppy run tpcc \
  -- --duration 10m
```

Open `reports/00-baseline.html` in a browser tab. This is your reference point.

### Step 2: Make a change and retest

Apply your first optimization (e.g., add an index, tune `work_mem`), then run the same test:

```bash
K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT=reports/01-add-covering-index.html \
  stroppy run tpcc \
  -- --duration 10m
```

### Step 3: Compare side by side

Open both reports in separate browser windows and tile them:

```bash
# Linux (xdg-open)
xdg-open reports/00-baseline.html &
xdg-open reports/01-add-covering-index.html &

# macOS
open reports/00-baseline.html
open reports/01-add-covering-index.html
```

Each report is self-contained with its own interactive charts. Tile two browser windows and compare response time distributions, throughput curves, and error rates.

### Step 4: Iterate

Keep going. Name reports after your changes:

```bash
# After tuning shared_buffers
K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT=reports/02-shared-buffers-2gb.html \
  stroppy run tpcc \
  -- --duration 10m

# After rewriting a query
K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT=reports/03-optimized-proc.html \
  stroppy run tpcc \
  -- --duration 10m
```

### Step 5: Name after commits

For serious optimization work, name reports after git commits:

```bash
COMMIT=$(git rev-parse --short HEAD)
MSG=$(git log -1 --pretty=%s | tr ' ' '-' | tr -cd '[:alnum:]-' | head -c 50)

K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT="reports/${COMMIT}-${MSG}.html" \
  stroppy run tpcc \
  -- --duration 10m
```

This produces files like:
```
reports/
  a1b2c3d-add-covering-index.html
  e4f5g6h-tune-shared-buffers.html
  i7j8k9l-optimize-payment-query.html
  m0n1o2p-enable-parallel-query.html
```

### Step 6: Review your collection

At the end of an optimization sprint, you have a folder of self-contained HTML reports, each named after a commit. Open them in separate tabs or windows to review the progression:

```bash
# Open all reports
for f in reports/*.html; do xdg-open "$f" & done
```

## Helper Script

Here's a convenience script you can save as `bench.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPORTS_DIR="${REPORTS_DIR:-reports}"
DURATION="${DURATION:-10m}"
WORKLOAD="${1:-tpcc}"

mkdir -p "$REPORTS_DIR"

# Build report name from git state
if git rev-parse --git-dir > /dev/null 2>&1; then
  COMMIT=$(git rev-parse --short HEAD)
  MSG=$(git log -1 --pretty=%s | tr ' ' '-' | tr -cd '[:alnum:]-' | head -c 50)
  DIRTY=$(git diff --quiet && echo "" || echo "-dirty")
  REPORT_NAME="${COMMIT}-${MSG}${DIRTY}"
else
  REPORT_NAME="run-$(date +%Y%m%d-%H%M%S)"
fi

REPORT_PATH="${REPORTS_DIR}/${REPORT_NAME}.html"

echo "Running benchmark: ${REPORT_NAME}"
echo "Report will be saved to: ${REPORT_PATH}"
echo "Duration: ${DURATION}"
echo ""

K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT="$REPORT_PATH" \
  stroppy run "$WORKLOAD" \
  -- --duration "$DURATION"

echo ""
echo "Report saved: ${REPORT_PATH}"
echo "Open with: xdg-open ${REPORT_PATH}"
```

Usage:

```bash
chmod +x bench.sh

# Run with defaults (TPC-C, 10 minutes)
./bench.sh

# Custom workload and duration
DURATION=30m ./bench.sh tpcc
```

## JSON Output for Programmatic Analysis

For automated comparison or CI pipelines, export raw metrics as JSON:

```bash
# Using the k6 binary directly
./build/k6 run \
  --out json=reports/results.json \
  workloads/tpcc/tpcc.ts

# Or pass through stroppy
stroppy run tpcc \
  -- --out json=reports/results.json
```

The JSON output contains every metric data point and can be ingested into InfluxDB, Prometheus, or processed with `jq` for quick comparisons.

## Stroppy-Specific Metrics

Beyond standard k6 metrics, Stroppy tracks:

| Metric | Type | Description |
|--------|------|-------------|
| `insert_duration` | Trend | Time spent on bulk insert operations (ms) |
| `insert_error_rate` | Rate | Fraction of failed insert operations |
| `run_query_duration` | Trend | Time spent on individual query execution (ms) |
| `run_query_count` | Counter | Total number of queries executed |
| `run_query_error_rate` | Rate | Fraction of failed queries |

These appear in both the web dashboard and HTML reports alongside standard k6 metrics (http_req_duration, iterations, vus, etc.).

## OpenTelemetry Export

For integration with your existing observability stack, Stroppy supports OTLP metrics export:

```typescript
const driverConfig = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
  exporter: {
    name: "stroppy-bench",
    otlpExport: {
      otlpGrpcEndpoint: "localhost:4317",
      otlpEndpointInsecure: true,
    },
  },
});

const driver = DriverX.create().setup(driverConfig);
```

This sends metrics to any OTLP-compatible backend (Jaeger, Grafana Tempo, etc.) for correlation with your application traces.

## Tips

- **Keep test duration consistent** across runs for fair comparison. 10 minutes is a good default.
- **Use the same scale factor** when comparing. Set `SCALE_FACTOR` explicitly.
- **Warm up the database** before the measured run, or include a ramp-up scenario.
- **Name reports descriptively.** Future-you will thank present-you.
- **Commit your test scripts** alongside your database code. They're part of the project.
