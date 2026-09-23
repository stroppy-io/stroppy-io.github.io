---
sidebar_position: 1
title: TPC-B
sidebar_label: TPC-B
description: TPC-B workload model, variants, parameters, steps, and metrics in Stroppy v6
---

# TPC-B

TPC-B models a short banking transaction over branches, tellers, accounts, and
history. It is useful for measuring transactional throughput, contention,
connection-pool behavior, and retry rates with a compact schema.

## Variants

| Workload | Execution | Drivers |
|---|---|---|
| `tpcb/tx` | Five ordered statements inside a driver transaction | PostgreSQL, MySQL, Picodata (`none`), YDB |
| `tpcb/procs` | One `tpcb_transaction` procedure call | PostgreSQL, MySQL |

```bash
stroppy run tpcb/tx -d pg \
  --executor constant-vus --vus 32 --duration 5m

stroppy run tpcb/procs -d mysql \
  --executor shared-iterations --iterations 100
```

## Transaction

Each iteration:

1. updates one account balance;
2. reads resulting account balance;
3. updates teller balance;
4. updates branch balance;
5. inserts one history row.

The `tx` variant groups these statements in one transaction. The `procs`
variant performs equivalent work in one server-side call.

## Scale and data

`--scale-factor` is integer branch count `B`.

| Table | Initial rows |
|---|---:|
| `pgbench_branches` | `B` |
| `pgbench_tellers` | `10 × B` |
| `pgbench_accounts` | `100,000 × B` |
| `pgbench_history` | 0; grows during transactions |

Rows are generated deterministically with typed `gen.IndexedSource` batches.
Filler columns use fixed-width ASCII allowed by the specification.

## Parameters

| Flag | Default | Meaning |
|---|---|---|
| `--scale-factor` | `1` | Branch count. |
| `--load-workers` | `1` | Workers per table load. |
| `--retry-attempts` | `3` | Maximum transaction attempts. |
| `--tx-isolation` | driver-derived | Isolation override. |
| `--sql-file` | selected dialect | SQL override. |

Shared flags also apply: `--executor`, `--vus`, `--iterations`, `--duration`,
and `--query-timeout`.

Default isolation:

| Driver | Isolation |
|---|---|
| PostgreSQL | `read_committed` |
| MySQL | `read_committed` |
| Picodata | `none` |
| YDB | `serializable` |

## Steps

| Step | Variants | Meaning |
|---|---|---|
| `drop_schema` | both | Remove existing tables and procedures. |
| `create_schema` | both | Create TPC-B tables. |
| `create_procedures` | `procs` | Create PostgreSQL/MySQL procedure. |
| `load_data` | both | Load branches, tellers, and accounts. |
| `create_indexes` | both | Create post-load indexes. |
| `create_foreign_keys` | both | Add PostgreSQL/MySQL references; no-op where unsupported. |
| `analyze` | both | Refresh PostgreSQL/MySQL planner statistics. |
| `workload` | both | Execute measured transaction loop. |

Load then measure:

```bash
stroppy run tpcb/tx -d pg --scale-factor 10 --load-workers 8 \
  --no-steps workload

stroppy run tpcb/tx -d pg --scale-factor 10 \
  --executor constant-vus --vus 32 --duration 10m \
  --steps workload
```

## SQL assets

| Driver | Asset |
|---|---|
| PostgreSQL | `workloads/tpcb/pg.sql` |
| MySQL | `workloads/tpcb/mysql.sql` |
| Picodata | `workloads/tpcb/pico.sql` |
| YDB | `workloads/tpcb/ydb.sql` |

Use a local override while editing:

```bash
stroppy run tpcb/tx ./workloads/tpcb/pg.sql -d pg
```

## Retry and errors

Drivers classify serialization, deadlock, lock-timeout, and transient errors.
TPC-B retries selected errors up to `--retry-attempts`. Successful retries do
not taint a run; terminal nonfatal errors fail one iteration, let the VU
continue, and appear in final error counters/summary.

`tpcb_retry_attempts` is the workload-specific retry counter. Core transaction
metrics include `transactions_total`, `tx_total_duration`, `tx_commits_total`,
`tx_errors_total`, and `tx_queries_per_tx`.

## Integration coverage

The v6 repository includes unit, asset-contract, and tagged PostgreSQL/MySQL
integration coverage. From source:

```bash
make tmpfs-up
make build
make integration
make tmpfs-down
```

Reference implementation:

- [`workloads/tpcb` at v6.0.0](https://github.com/stroppy-io/stroppy/tree/v6.0.0/workloads/tpcb)
