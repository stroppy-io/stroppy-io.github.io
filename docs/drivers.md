---
sidebar_position: 4
title: Drivers & Configuration
description: Stroppy v6 database drivers, presets, pools, TLS, load methods, and error behavior
---

# Drivers & Configuration

Stroppy passes CLI or JSON configuration directly to a registered Go driver.
Use `-d` for a preset and `-D` for field overrides.

```bash
stroppy run tpcc/tx -d pg
stroppy run tpcc/tx -d pg -D url=postgres://host:5432/bench
stroppy run tpcc/tx -d pg -D pool.maxConns=100
```

## Presets

| Preset | `driverType` | Default local URL | Notes |
|---|---|---|---|
| `pg` | `postgres` | `postgres://postgres:postgres@localhost:5432` | pgx pool; native COPY. |
| `mysql` | `mysql` | `myuser:mypassword@tcp(localhost:3306)/mydb?charset=utf8mb4&parseTime=True&loc=Local` | `database/sql`; bulk INSERT. |
| `pico` | `picodata` | `postgres://admin:T0psecret@localhost:1331` | PostgreSQL wire; no transactions. |
| `ydb` | `ydb` | `grpc://localhost:2136/local` | SQL plus native BulkUpsert. |
| `noop` | `noop` | `noop://localhost` | Discards I/O to measure framework overhead. |
| `crdb` | `crdb` | `postgres://root:@localhost:26257/defaultdb?sslmode=disable` | CockroachDB through pgx; engine-specific SQL and isolation defaults. |
| `yugabyte` | `yugabyte` | `postgres://yugabyte:@localhost:5433/yugabyte?sslmode=disable` | YugabyteDB YSQL through pgx. |
| `tidb` | `tidb` | `root:@tcp(localhost:4000)/test?charset=utf8mb4&parseTime=True&loc=Local` | TiDB through the MySQL driver. |
| `recording` | `recording` | `recording.json` | Database-free typed operation snapshots for workload tests. |

Aliases: `postgres` → `pg`, `picodata` → `pico`, `cockroach`/`cockroachdb` →
`crdb`, and `ysql`/`yb` → `yugabyte`. CSV is a driver type without a short preset.

The engine presets preserve the server's identity, not just its wire protocol.
Workloads can select their embedded engine-specific SQL automatically; use
`-d crdb`, rather than passing an embedded filename to `--sql-file`. That flag
requires a file on disk.

Credentials shown in preset URLs are public local-development defaults compiled
into Stroppy, not secrets. Always override them outside disposable local setups.

A preset sets `driverType`, URL, and a default insert method. Overrides keep
untouched preset fields:

```bash
stroppy run tpcb/tx -d mysql \
  -D 'url=root@tcp(mysql.example:3306)/bench?parseTime=true'
```

Raw JSON can replace a preset:

```bash
stroppy run tpcc/tx \
  -d '{"driverType":"postgres","url":"postgres://db:5432/bench"}'
```

Raw JSON is validated with the same strict field rules as config files.

## Named drivers

`-d`/`-D` configure the default database. Workloads that explicitly declare named
databases also accept `-dNAME` and `-DNAME`, such as `-dprimary pg` and
`-Dprimary url=postgres://pg/bench`. Names must match the workload's declarations;
`stroppy probe <workload>` lists them.

Built-in TPC workloads use one default database. Numeric suffixes such as `-d1`
and `-D1` are rejected in v6.2.0.

## Driver fields

| Field | Type | Description |
|---|---|---|
| `url` | string | Driver connection URL, DSN, or output path. |
| `driverType` | string | `postgres`, `mysql`, `picodata`, `ydb`, `crdb`, `yugabyte`, `tidb`, `noop`, `csv`, `recording`. |
| `bulkSize` | integer | Rows per multi-row INSERT/native batch; default 2500. |
| `defaultInsertMethod` | string | Fallback for requests with no workload-selected method. |
| `pool.*` | nested | Portable pool settings. |
| `postgres.*` | nested | pgx-specific settings. |
| `sql.*` | nested | `database/sql` settings. |
| `insertProgress.*` | nested | Load progress watcher. |
| `caCertFile` | string | CA certificate PEM path. |
| `authToken` | string | Token credential, especially for YDB. |
| `serviceAccountKeyFile` | string | Yandex Cloud JSON service-account key; SDK-managed IAM tokens. Requires verified `grpcs://`; takes precedence over `authToken`. |
| `authUser` / `authPassword` | string | Static credentials. |
| `tlsInsecureSkipVerify` | boolean | Skip certificate verification for testing only. |

The removed `errorMode` and `defaultTxIsolation` fields are rejected. Error
policy belongs to workloads; transaction isolation is a typed workload
parameter (`--tx-isolation`).

## Pool configuration

Portable pool fields map by driver family:

| Portable field | PostgreSQL/Picodata/CockroachDB/YugabyteDB | MySQL/TiDB/YDB |
|---|---|---|
| `pool.maxConns` | `postgres.maxConns` | `sql.maxOpenConns` |
| `pool.minConns` | `postgres.minConns` | `sql.maxIdleConns` |
| `pool.maxConnLifetime` | `postgres.maxConnLifetime` | `sql.connMaxLifetime` |
| `pool.maxConnIdleTime` | `postgres.maxConnIdleTime` | `sql.connMaxIdleTime` |

```bash
stroppy run tpcc/tx -d pg \
  -D pool.maxConns=100 \
  -D pool.minConns=20 \
  -D pool.maxConnLifetime=1h
```

Explicit `postgres.*` or `sql.*` values take priority over `pool.*`.

Additional pgx-family fields (PostgreSQL, Picodata, CockroachDB, YugabyteDB):

```text
postgres.minIdleConns
postgres.traceLogLevel
postgres.defaultQueryExecMode
postgres.descriptionCacheCapacity
postgres.statementCacheCapacity
```

Additional `database/sql`-family fields (MySQL, TiDB, YDB):

```text
sql.maxOpenConns
sql.maxIdleConns
sql.connMaxLifetime
sql.connMaxIdleTime
```

Noop, CSV, and recording do not use connection pools.

## Insert progress

Typed loads can log and export periodic progress:

```bash
stroppy run tpcc/tx -d pg \
  -D insertProgress.enabled=true \
  -D insertProgress.interval=30s \
  -D insertProgress.stallAfter=2m \
  -D insertProgress.mode=both
```

Modes: `off`, `log`, `metrics`, `both`.

Progress distinguishes generated, in-flight, and confirmed rows where the
backend can provide that distinction. A final completion or failure sample is
always emitted when tracking is enabled.

## Insert capabilities

`stroppy probe` reports current methods. In v6.2.0:

| Driver | `plain_query` | `plain_bulk` | `columnar` | `native` |
|---|---:|---:|---:|---:|
| PostgreSQL | yes | yes | yes | COPY |
| CockroachDB | yes | yes | yes | COPY |
| YugabyteDB | yes | yes | yes | COPY |
| MySQL | yes | yes | no | multi-row INSERT |
| TiDB | yes | yes | no | multi-row INSERT |
| Picodata | yes | yes | no | multi-row INSERT |
| YDB | yes | yes | BulkUpsert | BulkUpsert |
| Noop | drain | drain | drain | drain |
| CSV | no | no | no | files |
| Recording | capture | capture | capture | capture |

A workload-selected `driver.InsertRequest.Method` takes precedence over
`defaultInsertMethod`. The driver default fills only an unset request.

### PostgreSQL

PostgreSQL uses pgxpool.

- `native`: `COPY`.
- `columnar`: one array per column expanded with `unnest`, avoiding the 65535
  bound-parameter limit on wide batches.
- `plain_bulk`: multi-row INSERT.
- `plain_query`: one-row INSERT batches.

`postgres.defaultQueryExecMode` accepts `exec`, `cache_statement`,
`cache_describe`, `describe_exec`, or `simple_protocol`. Stroppy defaults to
`exec` when unset.

```bash
stroppy run tpch/tx -d pg \
  -D url=postgres://host:5432/bench \
  -D postgres.defaultQueryExecMode=cache_statement
```

### MySQL

MySQL uses `database/sql` and Go MySQL DSNs:

```bash
stroppy run tpcc/procs -d mysql \
  -D 'url=root@tcp(mysql.example:3306)/bench?parseTime=true'
```

`plain_bulk` uses multi-row INSERT. `native` maps to the same bulk path; Stroppy
does not use `LOAD DATA LOCAL INFILE`. Statement query timeouts also add a
server-side `MAX_EXECUTION_TIME` hint where applicable, reducing the chance that
a timed-out SELECT keeps work alive on a pooled connection.

### CockroachDB, YugabyteDB, and TiDB

```bash
stroppy run tpcb/tx -d crdb --scale-factor 1
stroppy run tpcc/tx -d yugabyte --scale-factor 1
stroppy run tpcc/tx -d tidb --scale-factor 1
```

CockroachDB and YugabyteDB inherit PostgreSQL's insert methods and `postgres.*`
pool fields; TiDB inherits MySQL's methods and `sql.*` fields. Workload SQL and
isolation defaults can differ from their protocol family. CockroachDB defaults
to `serializable` for TPC-B/C; TPC-C uses `read_committed` on YugabyteDB and
`repeatable_read` on TiDB. TiDB implements snapshot isolation without MySQL's
gap locking, so range contention can differ.

`--pg-unlogged` is PostgreSQL-only and does not change durability on these
engines. TPC-B/C procedure variants are documented for PostgreSQL/MySQL only.
In v6.2.0, `tpcc/procs -d tidb` can panic instead of rejecting the unsupported
combination; use `tpcc/tx -d tidb` ([#219](https://github.com/stroppy-io/stroppy/issues/219)).
See [TPC-DS](./tests/tpcds) for its engine-name limitations and workarounds.

### Picodata

Picodata uses its PostgreSQL wire endpoint through pgxpool.
It supports typed loads and SQL queries, subject to sbroad SQL limitations.

Picodata `Begin()` always returns an error. Transactional workload variants use
isolation `none` by default:

```bash
stroppy run tpcc/tx -d pico --tx-isolation none
```

TPC-H has a dedicated Picodata query port. TPC-DS is load-only on Picodata in
v6; run it with `--no-steps workload`.

### YDB

YDB accepts `grpc://` and `grpcs://` URLs. Native and columnar loads map to
`BulkUpsert`.

```bash
stroppy run tpcc/tx -d ydb \
  -D url=grpcs://host:2135/database \
  -D caCertFile=./ca.pem \
  -D authToken="$YDB_TOKEN"
```

Static credentials are also available through `authUser` and `authPassword`.
For a Yandex Cloud service-account key, let the SDK manage IAM token renewal:

```bash
stroppy run tpcc/tx -d ydb \
  -D url=grpcs://host:2135/database \
  -D serviceAccountKeyFile=./service-account.json
```

This mode takes precedence over `authToken` and rejects `grpc://` or
`tlsInsecureSkipVerify=true`; use `caCertFile` when a private CA is needed.
Keep key files and tokens out of recordings and report metadata. TPC workloads
normally use serializable isolation on YDB.

### Noop

Noop drives generation, batching, query construction, metrics, and transaction
bookkeeping, then discards I/O. Use `stroppy baseline` for a purpose-built
framework-overhead measurement.

### Recording

The `recording` driver captures typed query arguments, transaction boundaries,
and inserts without a database. It is intended for workload tests, not database
performance measurement. Query replies must be configured explicitly; unknown
reads return no rows. See [Custom Workloads](./custom-workloads) for test helpers.

### CSV

CSV writes typed load requests to files and has no query path. It requires
`native` insertion.

```bash
stroppy run tpcb/tx \
  -D driverType=csv \
  -D url='/tmp/tpcb-csv?merge=true&header=true&workload=tpcb' \
  --steps drop_schema,create_schema,load_data
```

URL options:

| Option | Default | Meaning |
|---|---|---|
| `merge` | `true` | Merge worker shards into one table CSV. |
| `header` | `true` | Include headers; sidecars when shards stay separate. |
| `separator` | `comma` | `comma`, `,`, `tab`, or `\t`. |
| `workload` | `default` | Output subdirectory. |

Fresh and repeated generations publish shards, merged files, and manifests
atomically. Failed or canceled loads retain recoverable shards without exposing
partial output as complete.

## Error classification and run behavior

Drivers translate backend errors into shared facts such as serialization,
deadlock, lock timeout, transient, timeout, cancellation, and unsupported.
Workloads choose actions; driver config does not.

Transactional workloads retry serialization conflicts, deadlocks, lock
timeouts, and unconditional transient facts by default. Conditional transient
retries require an idempotent workload operation.

A terminal nonfatal transaction error fails one iteration and lets the VU
continue. Query-set workloads count a failed query and continue. Both paths
print bounded warnings and a prominent final error summary while exiting `0`.
Setup, fatal, validation, and teardown failures remain nonzero.

See [Transactions & Errors](./transactions).

## Go driver interface

Adding a driver requires a source build. Current interface:

```go
type Driver interface {
    Insert(context.Context, *InsertRequest) (*stats.Query, error)
    RunQuery(context.Context, string, map[string]any) (*QueryResult, error)
    Begin(context.Context, config.TxIsolationLevel) (Tx, error)
    ClassifyError(error) ErrorFacts
    Teardown(context.Context) error
}
```

See [Extensibility](./extensibility) for registration and testing.
