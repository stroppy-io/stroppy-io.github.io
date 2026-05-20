---
sidebar_position: 3
title: Drivers & Configuration
description: Database driver presets, DB driver details, URLs, pools, and CLI overrides
---

# Drivers & Configuration

Every Stroppy test uses a driver configuration. The script declares defaults with `declareDriverSetup()`, and the CLI can override them with `-d` and `-D`.

```typescript
import { DriverX, declareDriverSetup } from "./helpers.ts";

const config = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
  defaultInsertMethod: "native",
});

const driver = DriverX.create().setup(config);
```

The index (`0` above) is the driver slot. CLI values for that slot are passed through `STROPPY_DRIVER_0` and merged over the script defaults.

## CLI Configuration

Use `-d` to select a preset and `-D` to override fields.

```bash
stroppy run tpcc/tx -d pg
stroppy run tpcc/tx -d pg -D url=postgres://user:pass@host:5432/bench
stroppy run tpcc/procs -d pg -d1 mysql
stroppy run tpcb/tx -D driverType=csv -D url='/tmp/tpcb-csv?merge=true&workload=tpcb'
```

| Flag | Description |
|------|-------------|
| `-d pg` | Configure driver slot 0 from the `pg` preset. |
| `-d1 mysql` | Configure driver slot 1 from the `mysql` preset. |
| `-d '{...}'` | Configure driver slot 0 from raw JSON. |
| `-D key=value` | Override a field on driver slot 0. |
| `-D1 key=value` | Override a field on driver slot 1. |

CLI-composed values do not overwrite an already-set `STROPPY_DRIVER_N` environment variable. This lets CI inject a full JSON driver config directly.

For repeatable runs with full driver objects, environment variables, steps, and k6 arguments, use a [configuration file](./config-file).

## Presets

Presets are shorthand for `driverType`, `url`, and `defaultInsertMethod`.

| Preset | `driverType` | Default URL | Default insert method |
|--------|--------------|-------------|-----------------------|
| `pg` | `postgres` | `postgres://postgres:postgres@localhost:5432` | `native` |
| `mysql` | `mysql` | `myuser:mypassword@tcp(localhost:3306)/mydb?charset=utf8mb4&parseTime=True&loc=Local` | `plain_bulk` |
| `pico` | `picodata` | `postgres://admin:T0psecret@localhost:1331` | `plain_bulk` |
| `ydb` | `ydb` | `grpc://localhost:2136/local` | `native` |
| `noop` | `noop` | `noop://localhost` | `plain_bulk` |

CSV is a driver type but has no short preset. Configure it with `-D driverType=csv` and a filesystem URL.

## Common Options

These fields can be set in TypeScript defaults, raw JSON, a config file, or with `-D key=value`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | none | Driver-specific connection URL or DSN. |
| `driverType` | string | none | `postgres`, `mysql`, `picodata`, `ydb`, `noop`, or `csv`. |
| `defaultInsertMethod` | string | script or preset | `native`, `plain_bulk`, or `plain_query`. Overrides each InsertSpec method when set. |
| `bulkSize` | int | `2500` | Rows per multi-row INSERT or native batch, where the driver uses batching. |
| `defaultTxIsolation` | string | `db_default` | `read_uncommitted`, `read_committed`, `repeatable_read`, `serializable`, `db_default`, `conn`, or `none`. |
| `errorMode` | string | `log` | `silent`, `log`, `throw`, `fail`, or `abort`. `STROPPY_ERROR_MODE` has highest precedence. |
| `caCertFile` | string | none | Path to a CA certificate PEM file for TLS connections. |
| `authToken` | string | none | Token credentials, mainly for YDB. |
| `authUser` | string | from URL/DSN | Static auth username when the URL/DSN does not provide one. |
| `authPassword` | string | from URL/DSN | Static auth password when the URL/DSN does not provide one. |
| `tlsInsecureSkipVerify` | bool | `false` | Disable TLS certificate verification for testing. |

## Error Modes

`errorMode` controls non-transaction query and insert error handling:

| Mode | Behavior |
|------|----------|
| `silent` | Record error metrics only. |
| `log` | Record metrics and print the error. This is the default. |
| `throw` | Rethrow the error to TypeScript. |
| `fail` | Mark the k6 iteration as failed with `test.fail()`. |
| `abort` | Abort the k6 run with `test.abort()`. |

`STROPPY_ERROR_MODE` has highest precedence over per-driver config.

Nested options use dot notation from the CLI:

```bash
stroppy run tpcc/tx -d pg -D pool.maxConns=100 -D pool.maxConnLifetime=30m
stroppy run tpcc/tx -d ydb -D caCertFile=./ca.pem -D authToken=t1.xxx
```

## Pool Options

`pool` is portable sugar. Stroppy maps it to the driver-specific pool block by `driverType`.

| `pool` option | PostgreSQL/Picodata mapping | MySQL/YDB mapping |
|---------------|-----------------------------|-------------------|
| `pool.maxConns` | `postgres.maxConns` | `sql.maxOpenConns` |
| `pool.minConns` | `postgres.minConns` | `sql.maxIdleConns` |
| `pool.maxConnLifetime` | `postgres.maxConnLifetime` | `sql.connMaxLifetime` |
| `pool.maxConnIdleTime` | `postgres.maxConnIdleTime` | `sql.connMaxIdleTime` |

The `pool` object also accepts driver-specific aliases such as `minIdleConns`, `traceLogLevel`, `defaultQueryExecMode`, `statementCacheCapacity`, `descriptionCacheCapacity`, `maxOpenConns`, `maxIdleConns`, `connMaxLifetime`, and `connMaxIdleTime`. Use explicit `postgres.*` or `sql.*` blocks when you want to avoid ambiguity.

Explicit `postgres` or `sql` blocks take priority over `pool`.

PostgreSQL/Picodata-specific options:

| Option | Description |
|--------|-------------|
| `postgres.maxConns` | Maximum pgx pool connections. |
| `postgres.minConns` | Minimum pgx pool connections. |
| `postgres.minIdleConns` | Minimum idle pgx connections. |
| `postgres.maxConnLifetime` | Maximum connection lifetime, e.g. `1h`. |
| `postgres.maxConnIdleTime` | Maximum idle lifetime, e.g. `10m`. |
| `postgres.traceLogLevel` | pgx trace log level: `debug`, `info`, `warn`, `error`. |
| `postgres.defaultQueryExecMode` | `exec`, `cache_statement`, `cache_describe`, `describe_exec`, or `simple_protocol`. Stroppy defaults PostgreSQL query execution to `exec`. |
| `postgres.statementCacheCapacity` | Statement cache size; only valid with `cache_statement`. |
| `postgres.descriptionCacheCapacity` | Description cache size; only valid with `cache_describe`. |

MySQL/YDB-specific options:

| Option | Description |
|--------|-------------|
| `sql.maxOpenConns` | Maximum open `database/sql` connections. |
| `sql.maxIdleConns` | Maximum idle `database/sql` connections. |
| `sql.connMaxLifetime` | Maximum connection lifetime, e.g. `1h`. |
| `sql.connMaxIdleTime` | Maximum idle lifetime, e.g. `10m`. |

`noop` and `csv` ignore pool options.

## DB Drivers

### PostgreSQL

Use PostgreSQL for full SQL, transaction, and native bulk-load coverage.

| Field | Value |
|-------|-------|
| `driverType` | `postgres` |
| Preset | `pg` |
| Default URL | `postgres://postgres:postgres@localhost:5432` |
| URL schemes | `postgres://`, `postgresql://`, and pgx-supported connection strings |
| Default insert method | `native` |
| Pool config | `pool.*` or `postgres.*` |

PostgreSQL supports `native`, `plain_bulk`, and `plain_query` inserts. `native` uses pgx `CopyFrom`; `plain_bulk` uses multi-row INSERT; `plain_query` uses one-row INSERT batches.

Transactions are supported, including regular transaction isolation and `conn` connection-only mode. Use `postgres.defaultQueryExecMode=exec` when you want every query to execute without pgx statement caching; this is Stroppy's default when the field is not set.

Example:

```bash
stroppy run tpcc/tx -d pg \
  -D url=postgres://user:pass@host:5432/bench \
  -D pool.maxConns=100 \
  -D postgres.defaultQueryExecMode=exec
```

### MySQL

Use MySQL for `database/sql` workloads and MySQL-specific dialect SQL.

| Field | Value |
|-------|-------|
| `driverType` | `mysql` |
| Preset | `mysql` |
| Default URL | `myuser:mypassword@tcp(localhost:3306)/mydb?charset=utf8mb4&parseTime=True&loc=Local` |
| URL schemes | Go MySQL DSN form, e.g. `user:pass@tcp(host:3306)/db?parseTime=True` |
| Default insert method | `plain_bulk` |
| Pool config | `pool.*` or `sql.*` |

MySQL supports `plain_bulk` and `plain_query`. `native` is accepted but maps to the same multi-row INSERT path because the driver does not use `LOAD DATA LOCAL INFILE`.

Transactions are supported through `database/sql`. TLS can be configured through the DSN or with `caCertFile` / `tlsInsecureSkipVerify` when the DSN does not already define TLS.

Example:

```bash
stroppy run tpcc/procs -d mysql \
  -D url='root:secret@tcp(mysql.local:3306)/bench?parseTime=True' \
  -D pool.maxConns=80
```

### Picodata

Use Picodata for SQL workloads over the PostgreSQL wire protocol.

| Field | Value |
|-------|-------|
| `driverType` | `picodata` |
| Preset | `pico` |
| Default URL | `postgres://admin:T0psecret@localhost:1331` |
| URL schemes | PostgreSQL-style URL, typically `postgres://user:pass@host:port/db` |
| Default insert method | `plain_bulk` |
| Pool config | `pool.*` or `postgres.*` |

Picodata supports SQL query execution and InsertSpec loading. `native` and `plain_bulk` both use multi-row INSERT; `plain_query` uses one-row INSERT batches.

Transactions are not supported by the Picodata driver. Workloads that run explicit transactions should use `TX_ISOLATION=none` or a variant that avoids `driver.beginTx()`.

Example:

```bash
stroppy run tpcc/tx -d pico \
  -D url=postgres://admin:T0psecret@pico.local:1331/public \
  -e TX_ISOLATION=none
```

### YDB

Use YDB for YQL workloads and native BulkUpsert loading.

| Field | Value |
|-------|-------|
| `driverType` | `ydb` |
| Preset | `ydb` |
| Default URL | `grpc://localhost:2136/local` |
| URL schemes | `grpc://host:port/database`, `grpcs://host:port/database` |
| Default insert method | `native` |
| Pool config | `pool.*` or `sql.*` |

YDB supports `native`, `plain_bulk`, and `plain_query`. `native` uses YDB Table API `BulkUpsert`; SQL inserts use the generic `database/sql` path.

Transactions are supported. TPC workloads typically default YDB to `serializable`. Use `grpcs://` for TLS, and use `authToken` or `authUser` / `authPassword` when the target requires credentials. If primary auth fails, the driver also tries Yandex Cloud metadata credentials.

Examples:

```bash
stroppy run tpcc/tx -d ydb -D url=grpc://localhost:2136/local

stroppy run tpcc/tx -d ydb \
  -D url=grpcs://ydb.example.net:2135/tenant/db \
  -D caCertFile=./ca.pem \
  -D authToken=t1.xxx
```

### Noop

Use Noop to measure Stroppy framework overhead without database I/O.

| Field | Value |
|-------|-------|
| `driverType` | `noop` |
| Preset | `noop` |
| Default URL | `noop://localhost` |
| URL schemes | `noop://...` |
| Default insert method | `plain_bulk` |
| Pool config | ignored |

Noop drains generators, builds queries, records metrics, and discards all final I/O. It is useful for estimating the cost of TypeScript, data generation, batching, and Stroppy driver plumbing.

Example:

```bash
stroppy run tpcb/tx -d noop -- --vus 4 --duration 30s
```

### CSV

Use CSV to emit generated relational data into files instead of a database.

| Field | Value |
|-------|-------|
| `driverType` | `csv` |
| Preset | none |
| Default URL | current working directory when `url` is empty |
| URL schemes | Filesystem path with optional query string, e.g. `/tmp/out?merge=true` |
| Default insert method | set `defaultInsertMethod=native` |
| Pool config | ignored |

CSV supports only relational InsertSpec loading through `native`. It accepts setup SQL for convenience: `DROP` clears output for idempotent reruns, while `CREATE`, `TRUNCATE`, `ALTER`, `COMMENT`, `SET`, and empty statements are accepted as no-ops. Runtime query execution is rejected.

CSV URL options:

| Query option | Default | Description |
|--------------|---------|-------------|
| `merge` | `true` | Merge worker shards into one `<table>.csv` at teardown. |
| `header` | `true` | Emit CSV headers. With `merge=false`, headers are sidecar files. |
| `separator` | `comma` | `comma`, `,`, `tab`, or `\t`. |
| `workload` | `STROPPY_CSV_WORKLOAD`, then `default` | Output subdirectory under the URL path. |

Example:

```bash
stroppy run tpcb/tx -D driverType=csv \
  -D defaultInsertMethod=native \
  -D url='/tmp/tpcb-csv?separator=comma&header=true&merge=true&workload=tpcb' \
  --steps drop_schema,create_schema,load_data
```

## Capability Matrix

| Capability | PostgreSQL | MySQL | Picodata | YDB | Noop | CSV |
|------------|------------|-------|----------|-----|------|-----|
| `runQuery` / `exec` | Yes | Yes | Yes | Yes | Stubbed | No |
| Transactions | Yes | Yes | No | Yes | Stubbed | No |
| `native` InsertSpec | COPY | Multi-row INSERT | Multi-row INSERT | BulkUpsert | Generator drain | CSV files |
| `plain_bulk` InsertSpec | Yes | Yes | Yes | Yes | Generator drain | No |
| `plain_query` InsertSpec | Yes | Yes | Yes | Yes | Generator drain | No |
| Pool options | `postgres.*` | `sql.*` | `postgres.*` | `sql.*` | Ignored | Ignored |

## Inspecting Driver Setup

Use `stroppy probe` to see the effective defaults declared by a script without running the workload:

```bash
stroppy probe tpcc/tx --drivers
stroppy probe tpch/tx --envs --drivers
```

Use `stroppy help drivers` in the CLI for the same option names in terminal help format.
