---
sidebar_position: 10
title: Extensibility
description: Add Go-native workloads, generators, SQL assets, and database drivers to Stroppy v6
---

# Extensibility

Stroppy v6 extensions are Go source compiled into the binary. There is no
runtime plugin or script loader. A product extension normally adds one of:

- a registered `bench.Test` workload, either in this repository or as your own
  standalone project;
- SQL/JSON/README assets owned by that workload package;
- a registered `driver.Driver`;
- deterministic generation code under `pkg/gen` or a workload package.

For a hands-on walkthrough — scaffold, test without a database, register,
package — start with [Custom workloads](./custom-workloads). This page is the
reference behind it.

## Workload definition

A workload is a `bench.Test` value: a name, a definition function, and an
optional publication of its own source.

```go
type Test struct {
    Name          string
    Define        func(*Def) error
    Source        fs.FS  // optional: files or a whole project, for stroppy eject
    SourcePackage string // original import path of a package-relative publication
}
```

```go
var Test = bench.Test{Name: "example/query", Define: define, Source: source,
    SourcePackage: "example.com/project/workload"}

func init() { bench.Register(Test) }
```

`Define` runs twice, with the same input snapshot: first to resolve parameters
and observe which steps exist — no actions, no database — then again to execute
the selected actions. Mutable run state is ordinary Go created inside `Define`;
registration itself carries no shared state. Never create that state at package
scope, because every replay and worker would share it.

## Typed parameters

Declare each value once and keep what it returns:

```go
func define(d *bench.Def) error {
    rows, _ := d.Param.Int64("rows", 100, "Rows to load.", bench.Min(int64(1)))
    scale, _ := d.Param.Int("scale-factor", 1, "Partition count.", bench.Aliases("partitions"))
    _ = rows
    _ = scale
    return nil
}
```

Methods return the resolved value plus `ParamInfo` provenance;
`String`, `Bool`, `Int`, `Int64`, `Uint64`, `Float64`, and `Duration` are
available, with `*Var` and generic `Declare[T]`/`Var[T]` forms for callers that
prefer destinations. A canonical lower-case kebab name projects to every channel:

- a `--name` CLI flag;
- an uppercase environment input;
- a lower-camel `params` config key;
- a schema entry in `stroppy probe -o json`.

Source precedence is typed CLI > process environment > matching typed config >
declared default, and a malformed supplied value fails rather than falling back.
`Min`, `Max`, and `OneOf` constrain both defaults and supplied values.
`bench.RunParameters` declares the shared run settings (`--executor`, `--vus`,
`--iterations`, `--duration`, `--drain-timeout`, `--query-timeout`) and returns
their resolved policy, but it is convenience over the same declarations rather
than an injected registry.

## Steps and policies

Steps are explicit and immediate: options precede the action, and a step without
a policy runs once.

```go
work := &accountWork{rows: rows}

d.Execution.Step("create", work.create)
d.Execution.Step("load", work.load)
d.Execution.Step("transfer", work.transfer, bench.SharedIterations(4, 100))
d.Execution.Step("cleanup", work.drop, bench.Always(30*time.Second))
return d.Execution.Err()
```

Repeated steps are measured automatically; `bench.Measure()` measures a
once-only step, and `bench.Use(ref)` selects a declared database for that step.
Policies are `bench.SharedIterations(workers, count)` and
`bench.ConstantWorkers(workers, duration, drain)`, with
`bench.SelectExecutor(mode, ...)` for input-driven selection. Timed policies stop
starting actions at expiry and drain what is running.

`Step` returns a `Result` with `Status` and `Err`; a linear definition ignores it
and returns `Execution.Err()` once. A once-only action error, `bench.Fatal`, or
parent cancellation stops later steps, while ordinary repeated-action errors
count failed iterations and let workers continue.

## Databases, queries, and reads

Declare references when a workload has soft defaults or more than one database:

```go
primary := d.Drivers.Declare("primary", bench.DriverConfig{Kind: bench.DriverPostgres})
secondary := d.Drivers.Declare("secondary", bench.DriverConfig{Kind: bench.DriverMySQL})
d.Execution.Step("compare", work.compare, policy, bench.Use(primary))
```

Operator configuration overrides authored defaults. Inside an action, `b.Exec`,
`b.QueryValue[T]`, `b.Insert`, and `b.Transaction` use the step-selected
database, and `b.Database(secondary)` returns another facade. `Exec` sends a
statement and discards rows; the read helpers are what let an iteration check an
answer. SQL assets load through the workload's own filesystem:

```go
queries, err := d.Queries.Load(files, "queries.sql")   // cwd, then ~/.stroppy, then embedded
handle := queries.Require("query", "select_one")
value, err := b.QueryValue[int64](ctx, handle.Text, nil)
```

`Override` reads only an explicit local file. See [SQL & Generators](./sql-and-generators)
for the section/query grammar.

## Typed loads

`b.Insert` takes a table and a batch source built by `gen`:

```go
source := gen.FromRows(rows, accountRow, gen.BatchRows(64), gen.MaxBytes(4096))
result, err := b.Insert(ctx, "account", source,
    bench.InsertMethod(bench.InsertPlainBulk), bench.LoadWorkers(4))
```

`gen.FromRows` derives columns from a shallow struct and fills reusable typed
batches; `accountRow(index uint64) (Account, error)` is an ordinary named
function. Advanced `BatchSource`/`Cursor`/`Row` sources remain available for
stateful or variable-cardinality algorithms, and `gen.Root`, `Domain`, `Field`,
`Draw`, `Permute`, and `SplitMix64` remain available for scalar generation.

See [SQL & Generators](./sql-and-generators) and the [parallelism
contract](https://github.com/stroppy-io/stroppy/blob/main/docs/parallelism.md).

## Transactions

```go
err := b.Transaction(ctx, bench.TransactionOptions{
    Name: "transfer",
    Isolation: bench.IsoReadCommitted,
    Retry: bench.RetryOptions{MaxAttempts: 3},
}, transfer.run)
```

The managed body receives `(context.Context, *bench.Tx)`; a nil return commits
and an error rolls back, with optional whole-body retry. Zero retry attempts mean
one attempt. Classification stays in the driver; retry policy stays in the
workload.

## Metrics and reports

Declare typed instruments under `d.Metrics` and record them with the action's
context:

```go
counter := d.Metrics.Counter("requests", bench.LabelValues("database", "primary", "secondary"))
latency := d.Metrics.Histogram("latency", bench.Unit("s"), bench.Bounds(.001, .01, .1, 1))
```

Labels must use finite declared keys and values. Database operations and logical
transactions already emit telemetry, and framework metric names are reserved.
`d.Report.Contribute(kind, schema, builder)` adds an independently copied final
snapshot to the run report; `Put` encodes a directly computed payload and
`Render` writes human output from it. See [Reports workflow](./reports-workflow).

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

A standalone project has no built-in catalog entry: it embeds its files the same
way and passes the filesystem to `d.Queries.Load` itself. `Test.Source` is what
`stroppy eject` restores.

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
| Minimal workload | [`workloads/simple`](https://github.com/stroppy-io/stroppy/tree/main/workloads/simple) |
| Transactional workload | [`workloads/tpcb`](https://github.com/stroppy-io/stroppy/tree/main/workloads/tpcb) |
| Stateful generator adapter | [`pkg/datagen/tpchgen`](https://github.com/stroppy-io/stroppy/tree/main/pkg/datagen/tpchgen) |
| PostgreSQL driver | [`pkg/driver/postgres`](https://github.com/stroppy-io/stroppy/tree/main/pkg/driver/postgres) |
| Shared SQL driver | [`pkg/driver/sqldriver`](https://github.com/stroppy-io/stroppy/tree/main/pkg/driver/sqldriver) |
| Sink driver | [`pkg/driver/csv`](https://github.com/stroppy-io/stroppy/tree/main/pkg/driver/csv) |
| Driver registry | [`pkg/driver/dispatcher.go`](https://github.com/stroppy-io/stroppy/blob/main/pkg/driver/dispatcher.go) |
