---
sidebar_position: 9
title: Extensibility
description: How to add a new database driver to Stroppy
---

# Extensibility

Stroppy uses a driver registry pattern. Adding a database target means implementing the Go driver interface, registering it, and adding the driver type to the shared config schema.

Stroppy currently registers six drivers:

| Driver | Package | Notes |
|--------|---------|-------|
| PostgreSQL | `pkg/driver/postgres` | pgx pool, COPY for native InsertSpec, transactions. |
| MySQL | `pkg/driver/mysql` | `database/sql`, multi-row inserts, transactions. |
| Picodata | `pkg/driver/picodata` | PostgreSQL-wire SQL path, no transactions. |
| YDB | `pkg/driver/ydb` | YDB SQL and native BulkUpsert. |
| Noop | `pkg/driver/noop` | Drains generators and discards I/O for framework overhead tests. |
| CSV | `pkg/driver/csv` | Emits InsertSpec rows to CSV files. |

## Driver Interface

Every driver implements `pkg/driver.Driver`:

```go
type Driver interface {
    InsertSpec(ctx context.Context, spec *dgproto.InsertSpec) (*stats.Query, error)
    RunQuery(ctx context.Context, sql string, args map[string]any) (*QueryResult, error)
    Begin(ctx context.Context, isolation stroppy.TxIsolationLevel) (Tx, error)
    Teardown(ctx context.Context) error
}
```

Transactions return `pkg/driver.Tx`:

```go
type Tx interface {
    RunQuery(ctx context.Context, sql string, args map[string]any) (*QueryResult, error)
    Commit(ctx context.Context) error
    Rollback(ctx context.Context) error
    Isolation() stroppy.TxIsolationLevel
}
```

The TypeScript layer calls these through `DriverX.exec()`, `DriverX.insertSpec()`, `DriverX.begin()`, and `DriverX.beginTx()`.

## InsertSpec Load Path

The current load path is relational InsertSpec. TypeScript builds an InsertSpec with `Rel.table(...)`, serializes it, and sends it to `Driver.InsertSpec`.

Driver implementations usually follow this pattern:

1. Validate `spec` and method support.
2. Build a deterministic datagen runtime with `runtime.NewRuntime(spec)`.
3. If `spec.parallelism.workers` is greater than 1, split work with `common.RunParallelByWorkers`.
4. Stream rows into the database using `spec.GetMethod()`.
5. Return `*stats.Query` with elapsed time and row count.

Example shape from SQL drivers:

```go
func (d *Driver) InsertSpec(ctx context.Context, spec *dgproto.InsertSpec) (*stats.Query, error) {
    if spec == nil {
        return nil, fmt.Errorf("%w: nil spec", runtime.ErrInvalidSpec)
    }

    workers := int(spec.GetParallelism().GetWorkers())
    if workers <= 1 {
        return d.insertSpecSingle(ctx, spec)
    }

    return d.insertSpecParallel(ctx, spec, workers)
}
```

Method mapping is driver-specific:

| Insert method | Typical implementation |
|---------------|------------------------|
| `NATIVE` | PostgreSQL COPY, YDB BulkUpsert, CSV output, Noop drain, or a driver-native fast path. |
| `COLUMNAR` | One array parameter per column, expanded by the database (PostgreSQL `unnest`). Optional; YDB redirects it to `BulkUpsert`. |
| `PLAIN_BULK` | Multi-row INSERT batches. |
| `PLAIN_QUERY` | Per-row INSERT path, often implemented as batch size 1. |

If a method is not supported, return `driver.ErrInsertSpecNotImplemented` or a driver-specific unsupported-method error.

## Query Execution

`RunQuery` receives SQL with Stroppy's named `:param` placeholders and an argument map. The driver is responsible for converting placeholders to the native dialect and returning a cursor-like `Rows` implementation.

Drivers based on `database/sql` can use the shared `sqldriver` package:

```go
func (d *Driver) RunQuery(
    ctx context.Context,
    sqlStr string,
    args map[string]any,
) (*driver.QueryResult, error) {
    return sqldriver.RunQuery(ctx, d.db, wrapRows, d.dialect, d.logger, sqlStr, args)
}
```

The dialect supplies placeholder formatting and value conversion. PostgreSQL-like dialects use `$1`, `$2`; MySQL uses `?`.

## Transactions

Drivers that support transactions implement `Begin`. Drivers that do not support transactions should return a clear error for normal isolation levels.

Special levels:

| Level | Runtime behavior |
|-------|------------------|
| `CONNECTION_ONLY` (`conn`) | Driver acquires a dedicated connection without issuing `BEGIN`; `Commit`/`Rollback` release the connection. |
| `NONE` (`none`) | The xk6 bridge wraps pool-level `RunQuery`; `Commit`/`Rollback` are no-ops. |

Picodata workloads usually use `TX_ISOLATION=none` because the Picodata driver does not implement database transactions.

## Adding a Driver

### 1. Add the driver type

Add the enum value to `proto/stroppy/config.proto`:

```protobuf
enum DriverType {
  DRIVER_TYPE_UNSPECIFIED = 0;
  DRIVER_TYPE_POSTGRES = 1;
  DRIVER_TYPE_MYSQL = 2;
  DRIVER_TYPE_PICODATA = 3;
  DRIVER_TYPE_YDB = 4;
  DRIVER_TYPE_NOOP = 5;
  DRIVER_TYPE_CSV = 6;
  DRIVER_TYPE_MYDB = 7;
}
```

Regenerate code:

```bash
make proto
```

### 2. Create the package

```
pkg/driver/mydb/
├── driver.go
├── run_query.go
├── insert_spec.go
└── tx.go
```

### 3. Register the driver

Register in the package `init()`:

```go
func init() {
    driver.RegisterDriver(
        stroppy.DriverConfig_DRIVER_TYPE_MYDB,
        func(ctx context.Context, opts driver.Options) (driver.Driver, error) {
            return NewDriver(ctx, opts)
        },
    )
}
```

The constructor receives `driver.Options`:

```go
type Options struct {
    DialFunc func(ctx context.Context, network, addr string) (net.Conn, error)
    Logger   *zap.Logger
    Config   *stroppy.DriverConfig
}
```

Use `opts.DialFunc` where possible so k6 network metrics still work.

### 4. Import it into the xk6 module

Add a blank import in `cmd/xk6air/instance.go` so the `init()` registration runs:

```go
import (
    _ "github.com/stroppy-io/stroppy/pkg/driver/mydb"
)
```

### 5. Add CLI and TypeScript names

Update the user-facing mappings so `declareDriverSetup()` and `-D driverType=mydb` understand the new string name:

- `internal/static/helpers.ts` driver type union and map.
- `internal/runner/driver_preset.go` if you want a short `-d` preset.
- `proto/stroppy/run.proto` comments for config-file docs if the type is public.

### 6. Build and test

```bash
make build
./build/stroppy probe my_workload.ts --drivers --envs --steps
./build/stroppy run my_workload.ts -D driverType=mydb -D url=mydb://localhost/db
```

## Registry Behavior

The dispatcher is intentionally small. Drivers self-register at import time, and `Dispatch` selects a constructor from the enum value in `DriverConfig`.

```go
var registry = map[stroppy.DriverConfig_DriverType]driverConstructor{}

func RegisterDriver(driverType stroppy.DriverConfig_DriverType, constructor driverConstructor) {
    registry[driverType] = constructor
}

func Dispatch(ctx context.Context, opts Options) (Driver, error) {
    drvType := opts.Config.GetDriverType()
    if constructor, ok := registry[drvType]; ok {
        return constructor(ctx, opts)
    }
    return nil, fmt.Errorf("driver type '%s': %w", drvType.String(), ErrNoRegisteredDriver)
}
```

Adding a driver should not require dispatcher changes beyond importing the package.

## Reference Implementations

Use existing drivers as templates:

| Driver | File to study | Why |
|--------|---------------|-----|
| PostgreSQL | `pkg/driver/postgres/insert_spec.go` | Native COPY and parallel InsertSpec. |
| MySQL | `pkg/driver/mysql/insert_spec.go` | `database/sql` plus shared bulk insert path. |
| YDB | `pkg/driver/ydb/insert_spec.go` | Native BulkUpsert and SQL fallback. |
| CSV | `pkg/driver/csv` | Sink driver that implements InsertSpec without SQL query execution. |
| Noop | `pkg/driver/noop` | Minimal driver for overhead measurement. |
