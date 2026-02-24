---
sidebar_position: 3
title: Extensibility
description: How to add a new database driver to Stroppy
---

# Extensibility

Stroppy uses a driver registry pattern. Adding support for a new database means implementing a Go interface and registering it. This page walks through the process.

## Driver Interface

Every driver implements four methods:

```go
// pkg/driver/dispatcher.go

type Driver interface {
    // Execute a bulk insert operation
    InsertValues(ctx context.Context, unit *stroppy.InsertDescriptor) (*stats.Query, error)

    // Execute a single SQL query with named parameters
    RunQuery(ctx context.Context, sql string, args map[string]any) (*stats.Query, error)

    // Clean up resources (close connections, pools, etc.)
    Teardown(ctx context.Context) error

    // Reconfigure the driver (e.g., inject k6's DialFunc for network metrics)
    Configure(ctx context.Context, opts Options) error
}
```

`InsertValues` receives an `InsertDescriptor` containing the table name, insertion method, column definitions with generation rules, and row count. The driver is responsible for generating values according to the rules and inserting them.

`RunQuery` receives raw SQL with `:param` placeholders already present. The driver must convert them to its native placeholder format and execute the query.

Both return `*stats.Query` which tracks execution time for metrics.

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
    "fmt"

    _ "github.com/go-sql-driver/mysql"
    "go.uber.org/zap"

    stroppy "github.com/stroppy-io/stroppy/pkg/common/proto/stroppy"
    "github.com/stroppy-io/stroppy/pkg/driver"
    "github.com/stroppy-io/stroppy/pkg/driver/stats"
)

// Register this driver at import time
func init() {
    driver.RegisterDriver(
        stroppy.DriverConfig_DRIVER_TYPE_MYSQL,  // Add this to the proto enum
        func(ctx context.Context, lg *zap.Logger, config *stroppy.DriverConfig) (driver.Driver, error) {
            return NewDriver(ctx, lg, config)
        },
    )
}

type Driver struct {
    logger *zap.Logger
    db     *sql.DB
}

// Ensure compile-time interface satisfaction
var _ driver.Driver = new(Driver)

func NewDriver(
    ctx context.Context,
    lg *zap.Logger,
    cfg *stroppy.DriverConfig,
) (*Driver, error) {
    db, err := sql.Open("mysql", cfg.GetUrl())
    if err != nil {
        return nil, fmt.Errorf("mysql connect: %w", err)
    }

    if err := db.PingContext(ctx); err != nil {
        return nil, fmt.Errorf("mysql ping: %w", err)
    }

    return &Driver{logger: lg, db: db}, nil
}
```

### 3. Implement RunQuery

Convert `:param` placeholders to MySQL's `?` syntax:

```go
// pkg/driver/mysql/query.go
package mysql

import (
    "context"
    "regexp"
    "time"

    "github.com/stroppy-io/stroppy/pkg/driver/stats"
)

var paramRegex = regexp.MustCompile(`(?:\s|^|\()(:([a-zA-Z0-9_]+))(?:\s|$|;|,|\))`)

func (d *Driver) RunQuery(
    ctx context.Context,
    sql string,
    args map[string]any,
) (*stats.Query, error) {
    // Convert :param to ? and build ordered args slice
    var orderedArgs []any
    paramIndex := map[string]int{}

    converted := paramRegex.ReplaceAllStringFunc(sql, func(match string) string {
        // Extract param name, replace with ?
        // ... (handle deduplication like the postgres driver)
        return "?"
    })

    start := time.Now()
    _, err := d.db.ExecContext(ctx, converted, orderedArgs...)
    elapsed := time.Since(start)

    if err != nil {
        return nil, err
    }
    return &stats.Query{Elapsed: elapsed}, nil
}
```

### 4. Implement InsertValues

```go
// pkg/driver/mysql/insert.go
package mysql

import (
    "context"

    stroppy "github.com/stroppy-io/stroppy/pkg/common/proto/stroppy"
    "github.com/stroppy-io/stroppy/pkg/driver/stats"
)

func (d *Driver) InsertValues(
    ctx context.Context,
    unit *stroppy.InsertDescriptor,
) (*stats.Query, error) {
    // Generate values according to unit.Params generation rules
    // Build INSERT statements or use LOAD DATA for bulk
    // Execute and track timing
    return nil, nil
}
```

### 5. Implement Teardown and Configure

```go
func (d *Driver) Teardown(_ context.Context) error {
    return d.db.Close()
}

func (d *Driver) Configure(_ context.Context, opts driver.Options) error {
    // Optionally apply k6's DialFunc for network metrics tracking
    return nil
}
```

### 6. Add the driver type enum

In `proto/stroppy/config.proto`, add your driver type to the `DriverType` enum and regenerate the type definitions:

```bash
make proto
```

### 7. Register via import

In `cmd/xk6air/module.go`, add a blank import so `init()` runs:

```go
import (
    _ "github.com/stroppy-io/stroppy/pkg/driver/mysql"
    _ "github.com/stroppy-io/stroppy/pkg/driver/postgres"
)
```

### 8. Build and test

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
    lg *zap.Logger,
    config *stroppy.DriverConfig,
) (Driver, error) {
    if constructor, ok := registry[drvType]; ok {
        return constructor(ctx, lg, config)
    }
    return nil, fmt.Errorf("driver type '%s': no registered driver", drvType)
}
```

Drivers self-register via Go's `init()` function. The `init()` runs when the package is imported (even as a blank import `_`). This means adding a driver requires zero changes to the dispatcher code &mdash; just implement, register, and import.

## The k6 Module Layer

Between your TypeScript and the Go driver sits the k6 module (`cmd/xk6air/`). It:

1. **Deserializes** your `GlobalConfig` from TypeScript
2. **Dispatches** to the correct driver via the registry
3. **Wraps** the driver with per-VU context (each k6 virtual user gets its own driver wrapper)
4. **Tracks metrics** (insert duration, query duration, error rates)
5. **Injects** k6's `DialFunc` via `Configure()` so network metrics are captured

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
