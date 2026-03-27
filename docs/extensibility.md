---
sidebar_position: 3
title: Extensibility
description: How to add a new database driver to Stroppy
---

# Extensibility

Stroppy uses a driver registry pattern. Adding support for a new database means implementing a Go interface and registering it. This page walks through the process.

Stroppy currently ships with three drivers:

| Driver | Package | Interface | Placeholder |
|--------|---------|-----------|-------------|
| **PostgreSQL** | `pkg/driver/postgres` | pgx (native) | `$1, $2, ...` |
| **MySQL** | `pkg/driver/mysql` | `database/sql` via `sqldriver` | `?` |
| **Picodata** | `pkg/driver/picodata` | picodata-go | `$1, $2, ...` |

The MySQL and Picodata drivers were added in v3.1.0 using the shared `sqldriver` package, which handles the common parts of any `database/sql`-compatible driver.

## Driver Interface

Every driver implements the `Driver` interface, and may return a `Tx` from `BeginTx`:

```go
// pkg/driver/dispatcher.go

type Driver interface {
    // Execute a bulk insert operation
    InsertValues(ctx context.Context, unit *stroppy.InsertDescriptor) (*stats.Query, error)

    // Execute a single SQL query with named parameters
    RunQuery(ctx context.Context, sql string, args map[string]any) (*QueryResult, error)

    // Begin a transaction with the given isolation level
    BeginTx(ctx context.Context, isolation stroppy.TxIsolationLevel) (Tx, error)

    // Clean up resources (close connections, pools, etc.)
    Teardown(ctx context.Context) error
}

type Tx interface {
    // Execute a query within the transaction
    RunQuery(ctx context.Context, sql string, args map[string]any) (*QueryResult, error)

    // Commit the transaction
    Commit(ctx context.Context) error

    // Rollback the transaction
    Rollback(ctx context.Context) error

    // Return the isolation level of this transaction
    Isolation() stroppy.TxIsolationLevel
}
```

`BeginTx` opens a database transaction at the requested isolation level. The returned `Tx` supports the same `RunQuery` interface as the driver itself, plus `Commit` and `Rollback`. TypeScript scripts access this through `driver.begin()` and `driver.beginTx()`.

`InsertValues` receives an `InsertDescriptor` containing the table name, insertion method, column definitions with generation rules, and row count. The driver is responsible for generating values according to the rules and inserting them. Returns `*stats.Query` which tracks execution time for metrics.

`RunQuery` receives raw SQL with `:param` placeholders already present. The driver must convert them to its native placeholder format and execute the query. Returns `*QueryResult` containing both timing statistics and a `Rows` cursor for reading results.

Configuration (connection URL, pool settings, k6's `DialFunc` for network metrics) is passed to the driver constructor via the `Options` struct &mdash; there is no separate configuration step.

## Step-by-Step: Adding a MySQL Driver

### 1. Create the package

```
pkg/driver/mysql/
├── driver.go
├── query.go
└── insert.go
```

### 2. Implement the driver

```go
// pkg/driver/mysql/driver.go
package mysql

import (
    "context"
    "database/sql"

    "go.uber.org/zap"

    stroppy "github.com/stroppy-io/stroppy/pkg/common/proto/stroppy"
    "github.com/stroppy-io/stroppy/pkg/driver"
    "github.com/stroppy-io/stroppy/pkg/driver/sqldriver"
    "github.com/stroppy-io/stroppy/pkg/driver/sqldriver/queries"
)

// Register this driver at import time
func init() {
    driver.RegisterDriver(
        stroppy.DriverConfig_DRIVER_TYPE_MYSQL,
        func(ctx context.Context, opts driver.Options) (driver.Driver, error) {
            return NewDriver(ctx, opts)
        },
    )
}

type Driver struct {
    db      *sql.DB
    dialect queries.Dialect
    logger  *zap.Logger
}

// Ensure compile-time interface satisfaction
var _ driver.Driver = (*Driver)(nil)

func NewDriver(
    ctx context.Context,
    opts driver.Options,
) (*Driver, error) {
    lg := opts.Logger
    cfg := opts.Config

    // Open connection — opts.DialFunc is available for k6 network metrics
    db, err := sql.Open("mysql", cfg.GetUrl())
    if err != nil {
        return nil, fmt.Errorf("mysql connect: %w", err)
    }

    // Wait for the database to become available
    if err = sqldriver.WaitForDB(ctx, lg, db, 0); err != nil {
        db.Close()
        return nil, err
    }

    return &Driver{db: db, dialect: mysqlDialect{}, logger: lg}, nil
}
```

### 3. Implement RunQuery and InsertValues

With the shared `sqldriver` package, both methods delegate to common implementations. The only thing specific to your driver is the **Dialect**:

```go
// pkg/driver/mysql/dialect.go
package mysql

type mysqlDialect struct{}

// MySQL uses ? for all placeholders
func (mysqlDialect) Placeholder(_ int) string { return "?" }

// Convert Stroppy protobuf values to Go types MySQL understands
func (mysqlDialect) ValueToAny(value *stroppy.Value) (any, error) {
    switch typed := value.GetType().(type) {
    case *stroppy.Value_Int64:   return typed.Int64, nil
    case *stroppy.Value_String_: return typed.String_, nil
    case *stroppy.Value_Decimal: return value.GetDecimal().GetValue(), nil
    // ... handle other types
    }
}
```

Then `RunQuery` and `InsertValues` use the shared package:

```go
func (d *Driver) RunQuery(
    ctx context.Context,
    sqlStr string,
    args map[string]any,
) (*driver.QueryResult, error) {
    return sqldriver.RunQuery(ctx, d.db, d.dialect, d.logger, sqlStr, args)
}

func (d *Driver) InsertValues(
    ctx context.Context,
    descriptor *stroppy.InsertDescriptor,
) (*stats.Query, error) {
    builder, err := queries.NewQueryBuilder(d.logger, d.dialect, seed, descriptor)
    if err != nil {
        return nil, err
    }

    switch descriptor.GetMethod() {
    case stroppy.InsertMethod_PLAIN_QUERY:
        return sqldriver.InsertPlainQuery(ctx, d.db, builder)
    case stroppy.InsertMethod_PLAIN_BULK:
        return sqldriver.InsertPlainBulk(ctx, d.db, builder, 1000)
    default:
        return nil, fmt.Errorf("unsupported insert method: %s", descriptor.GetMethod())
    }
}
```

The shared `sqldriver.RunQuery` handles `:param` &rarr; `?` conversion using the dialect's `Placeholder` method, executes the query, and wraps the result rows in a `QueryResult`.

### 4. Implement Teardown

```go
func (d *Driver) Teardown(ctx context.Context) error {
    return sqldriver.Teardown(ctx, d.db)
}
```

### 5. Add the driver type enum

In `proto/stroppy/config.proto`, add your driver type to the `DriverType` enum and regenerate the type definitions:

```bash
make proto
```

### 6. Register via import

In `cmd/xk6air/module.go`, add a blank import so `init()` runs:

```go
import (
    _ "github.com/stroppy-io/stroppy/pkg/driver/mysql"
    _ "github.com/stroppy-io/stroppy/pkg/driver/picodata"
    _ "github.com/stroppy-io/stroppy/pkg/driver/postgres"
)
```

### 7. Build and test

```bash
make build
./build/stroppy run my_mysql_test.ts
```

## How the Registry Works

The dispatcher is minimal by design:

```go
var registry = map[stroppy.DriverConfig_DriverType]driverConstructor{}

func RegisterDriver(
    driverType stroppy.DriverConfig_DriverType,
    constructor driverConstructor,
) {
    registry[driverType] = constructor
}

func Dispatch(
    ctx context.Context,
    opts Options,
) (Driver, error) {
    drvType := opts.Config.GetDriverType()
    if constructor, ok := registry[drvType]; ok {
        return constructor(ctx, opts)
    }
    return nil, fmt.Errorf("driver type '%s': no registered driver", drvType)
}
```

The `Options` struct bundles everything a driver needs at construction time:

```go
type Options struct {
    DialFunc func(ctx context.Context, network, addr string) (net.Conn, error)
    Logger   *zap.Logger
    Config   *stroppy.DriverConfig
}
```

Drivers self-register via Go's `init()` function. The `init()` runs when the package is imported (even as a blank import `_`). This means adding a driver requires zero changes to the dispatcher code &mdash; just implement, register, and import.

## The k6 Module Layer

Between your TypeScript and the Go driver sits the k6 module (`cmd/xk6air/`). It:

1. **Deserializes** your `GlobalConfig` from TypeScript
2. **Dispatches** to the correct driver via the registry, passing `Options` with config, logger, and k6's `DialFunc` for network metrics
3. **Wraps** the driver with per-VU context (each k6 virtual user gets its own driver wrapper)
4. **Tracks metrics** (insert duration, query duration, error rates)

You generally don't need to modify this layer when adding a driver. The module calls `driver.Dispatch()` with the config your TypeScript provides, and your registered constructor handles the rest.

## Data Generation in Drivers

When implementing `InsertValues`, your driver receives an `InsertDescriptor` that contains:

- `tableName` &mdash; Target table
- `count` &mdash; Number of rows to generate
- `method` &mdash; `PLAIN_QUERY` or `COPY_FROM` (or your own custom method)
- `params` &mdash; Column definitions with generation rules for each
- `groups` &mdash; Grouped parameters for tuple generation

Use the `generate` package (`pkg/common/generate/`) to create generators from rules:

```go
import "github.com/stroppy-io/stroppy/pkg/common/generate"

gen, err := generate.NewValueGenerator(seed, rule)
value := gen.Next()
```

The PostgreSQL driver's implementation in `pkg/driver/postgres/insert.go` is a good reference for both plain query and COPY protocol insertion.
