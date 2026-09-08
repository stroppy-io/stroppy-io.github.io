---
sidebar_position: 10
title: Extensibility
description: Add Go-native workloads, generators, SQL assets, and database drivers to Stroppy v6
---

# Extensibility

Stroppy v6 extensions are Go source compiled into the binary. There is no
runtime plugin or script loader. A product extension normally adds one of:

- a registered `bench.Workload`;
- SQL/JSON/README assets owned by that workload package;
- a registered `driver.Driver`;
- deterministic generation code under `pkg/gen` or a workload package.

## Workload interface

```go
type Workload interface {
    Name() string
    Define(*Def) error
    Setup(context.Context, *Bench) error
    Iterate(context.Context, *Bench) error
    Teardown(context.Context, *Bench) error
}
```

Lifecycle:

1. `Define` declares typed parameters and captures resolved values.
2. `Setup` runs once before virtual users start.
3. `Iterate` runs according to selected executor.
4. `Teardown` runs after completion or graceful cancellation.

Register a fresh factory from package `init`:

```go
func init() {
    bench.Register(func() bench.Workload { return &workload{} })
}
```

Factories must return a new non-nil workload. Names are global and unique.

## Typed parameters

`Define` declares each workload value once:

```go
func (w *workload) Define(d *bench.Def) error {
    w.scale = d.Param.Int("scale-factor", 1, "Number of partitions.").Value()
    w.workers = d.Param.Int("load-workers", 1, "Load workers.").Value()
    w.sqlFile = d.Param.String("sql-file", "", "SQL override.").Value()
    return nil
}
```

Supported scalar types include string, boolean, integer, float, and duration.
Each declaration becomes:

- a `--name` CLI flag;
- an uppercase environment input;
- a lower-camel `params` config key;
- a schema entry in `stroppy probe -o json`.

Shared executor parameters are declared by the engine under config `run`.

## Steps and queries

Wrap setup or workload phases with `Bench.Step`:

```go
func (w *workload) Setup(ctx context.Context, b *bench.Bench) error {
    if err := b.Step("create_schema", func() error {
        return b.Exec(ctx, "CREATE TABLE events (id BIGINT PRIMARY KEY)", nil)
    }); err != nil {
        return err
    }

    return b.Step("load_data", func() error {
        _, err := b.Insert(ctx, w.insertRequest())
        return err
    })
}
```

Use `StepSilent("workload", ...)` for per-iteration work to avoid log spam.

`Bench` query helpers include `Exec`, `QueryRows`, `QueryRow`, and `QueryValue`.
They accept `:named` parameters through `map[string]any`.

## Typed loads

Construct a `driver.InsertRequest` with table, method, worker count, and
`gen.BatchSource`:

```go
return &driver.InsertRequest{
    Table:   "events",
    Method:  driver.InsertPlainBulk,
    Workers: w.workers,
    Source:  source,
}
```

Use `gen.SchemaBuilder` plus `gen.NewIndexedSource` for index-addressable row
formulas. Stateful canonical generators implement `gen.BatchSource` directly
and provide partition seeking.

See [SQL & Generators](./sql-and-generators) and the pinned
[v6 parallelism contract](https://github.com/stroppy-io/stroppy/blob/v6.0.0/docs/parallelism.md).

## Workload-owned assets

Asset-bearing packages embed their own files:

```go
//go:embed *.sql README.md
var files embed.FS

func init() {
    workloads.Register(workloads.PresetTPCB, files)
}
```

Add a preset constant/catalog entry when introducing a new asset namespace.
Then blank-import its package in `workloads/all/import.go` so all built-ins
register predictably.

Keep required filenames, sections, and named queries pinned with package
contract tests. Existing `workloads/internal/workloadtest` helpers validate
embedded files and SQL structure.

## Driver interface

```go
type Driver interface {
    Insert(context.Context, *InsertRequest) (*stats.Query, error)
    RunQuery(context.Context, string, map[string]any) (*QueryResult, error)
    Begin(context.Context, config.TxIsolationLevel) (Tx, error)
    ClassifyError(error) ErrorFacts
    Teardown(context.Context) error
}
```

Transactions return:

```go
type Tx interface {
    RunQuery(context.Context, string, map[string]any) (*QueryResult, error)
    Commit(context.Context) error
    Rollback(context.Context) error
    Isolation() config.TxIsolationLevel
}
```

Constructor options include resolved driver config, logger, optional network
dialer, and per-statement query timeout.

## Adding a driver

### 1. Add type and user config

Add a `config.DriverType` constant, string mapping, and value enumeration under
`pkg/config`. Extend strict config/schema tests and regenerate schema:

```bash
go generate ./pkg/config
```

### 2. Implement package

Suggested layout:

```text
pkg/driver/mydb/
├── driver.go
├── errors.go
├── dialect.go
├── insert.go
└── tx.go
```

SQL drivers can reuse `pkg/driver/sqldriver` for placeholder conversion,
`database/sql` execution, rows normalization, bulk inserts, and teardown.

### 3. Register constructor

```go
func init() {
    driver.RegisterDriver(config.DriverTypeMyDB, NewDriver)
}
```

Constructor shape:

```go
func NewDriver(ctx context.Context, opts driver.Options) (driver.Driver, error)
```

### 4. Classify errors

Translate backend-specific errors into `driver.ErrorFacts`. Do not choose retry
or fatal behavior inside the driver; workloads own that policy.

Cover serialization, deadlock, lock timeout, transient, timeout, cancellation,
and unsupported cases the backend can identify reliably. Unknown input should
remain unknown.

### 5. Import package

Add a blank import in `cmd/stroppy/main.go` so registration runs in the binary.

### 6. Advertise capabilities

Update `driver.InsertCapabilities` and probe tests. Add a short preset in
`internal/runner/driver_preset.go` only when useful.

## Build and test

Follow repository commands:

```bash
make build
make tests
make linter
```

Tagged integration requires the built binary and baseline services:

```bash
make tmpfs-up
make build
make integration
make tmpfs-down
```

Add package tests for registration, malformed input, capability resolution,
cancellation, and backend error classification. Add integration coverage when
behavior depends on a real database.

## Reference implementations

| Area | Source |
|---|---|
| Minimal workload | [`workloads/simple`](https://github.com/stroppy-io/stroppy/tree/v6.0.0/workloads/simple) |
| Transactional workload | [`workloads/tpcb`](https://github.com/stroppy-io/stroppy/tree/v6.0.0/workloads/tpcb) |
| Stateful generator adapter | [`pkg/datagen/tpchgen`](https://github.com/stroppy-io/stroppy/tree/v6.0.0/pkg/datagen/tpchgen) |
| PostgreSQL driver | [`pkg/driver/postgres`](https://github.com/stroppy-io/stroppy/tree/v6.0.0/pkg/driver/postgres) |
| Shared SQL driver | [`pkg/driver/sqldriver`](https://github.com/stroppy-io/stroppy/tree/v6.0.0/pkg/driver/sqldriver) |
| Sink driver | [`pkg/driver/csv`](https://github.com/stroppy-io/stroppy/tree/v6.0.0/pkg/driver/csv) |
| Driver registry | [`pkg/driver/dispatcher.go`](https://github.com/stroppy-io/stroppy/blob/v6.0.0/pkg/driver/dispatcher.go) |
