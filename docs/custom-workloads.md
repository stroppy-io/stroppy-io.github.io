---
sidebar_position: 11
title: Custom workloads
description: Build a Go workload with stroppy init, test it without a database, and register it for stroppy run
---

# Custom workloads

A custom workload is an ordinary Go module that you own. It runs two ways: as its
own binary, and — once registered — by name through the installed `stroppy`,
from an owned snapshot, with no source tree required afterwards.

This page builds two complete workloads from `stroppy init`:

- **`select1`** — the smallest workload that *checks* something: one statement,
  one expected answer.
- **`selectfile`** — the same idea with the statement in a SQL file and
  parameters of its own.

Both use the supported authoring API and need no database for their own tests.
For the engine internals behind them see [Extensibility](./extensibility); for
the built-in workloads you can already run see [Presets](./presets).

Both are also published as runnable projects in
[stroppy-contrib](https://github.com/stroppy-io/stroppy-contrib), where CI tests
them against each project's pinned SDK on every change and against Stroppy `main`
on a schedule — so the samples are checked, not just documented.

:::note
The author tooling (`init`, `build`, `eject`, `list`, `remove`, `export`) ships
with the next v6 release. A binary built from `main` has it today; released
binaries before it do not.
:::

## Requirements

- The `stroppy` binary, on `PATH`.
- Go 1.27 or newer — `stroppy init` resolves dependencies with a real Go
  compiler and can install a verified private one under `~/.stroppy`.
- A database to run against, or the pg-noop server described below.

## Scaffold a project

```bash
stroppy init select1
cd select1
```

```text
select1/
├── go.mod            module example.com/select1, Go 1.27, requires the SDK
├── go.sum
├── main.go           func main() { stroppy.Main(workload.Test) }
├── README.md
├── LICENSE
└── workload/
    ├── workload.go       the definition you edit
    ├── workload_test.go  a recording test that needs no database
    ├── README.md
    └── LICENSE
```

The generated `workload.go` is already a working workload:

```go
func define(d *bench.Def) error {
    run := bench.RunParameters(&d.Param, bench.RunDefaults{Iterations: 10})
    d.Drivers.Declare("default", bench.DriverConfig{Kind: bench.DriverNoop})
    d.Execution.Step("query", query, run.Policy())
    return d.Execution.Err()
}

func query(ctx context.Context, b *bench.Bench) error {
    return b.Exec(ctx, "SELECT :value", map[string]any{"value": b.Iteration()})
}
```

`go run . -d noop` works before you change anything — a known-good skeleton to
edit against.

## Sample 1: `select1`

Replace `workload/workload.go` with the whole workload:

```go
package workload

import (
    "context"
    "embed"
    "fmt"

    "github.com/stroppy-io/stroppy/v6/pkg/bench"
)

//go:embed *.go LICENSE README.md
var source embed.FS

const selectOne = "SELECT 1"

var Test = bench.Test{Name: "select1", Define: define, Source: source, SourcePackage: "example.com/select1/workload"}

func init() { bench.Register(Test) }

func define(d *bench.Def) error {
    run := bench.RunParameters(&d.Param, bench.RunDefaults{Iterations: 1})
    d.Drivers.Declare("default", bench.DriverConfig{Kind: bench.DriverPostgres})
    d.Execution.Step("query", query, run.Policy())
    return d.Execution.Err()
}

// query reads the answer instead of discarding it: an iteration passes only when
// the database really returns 1.
func query(ctx context.Context, b *bench.Bench) error {
    value, err := b.QueryValue[int64](ctx, selectOne, nil)
    if err != nil {
        return err
    }

    if value != 1 {
        return fmt.Errorf("%s returned %d, want 1", selectOne, value)
    }

    return nil
}
```

Five things carry the meaning:

- **`Test`** is the descriptor: a name, a `Define` function, and optionally
  published source. `init()` registers it. There is no lifecycle interface to
  implement.
- **`Define` observes, then steps.** The runtime calls it twice — once to
  resolve inputs and record which steps exist (no actions, no database), then
  again to run the selected actions. Keep side effects inside actions.
- **`RunParameters`** adds the standard run settings (`--executor`, `--vus`,
  `--iterations`, `--duration`, `--drain-timeout`, `--query-timeout`), and
  `run.Policy()` gives the step an execution policy. `Iterations: 1` is what the
  workload does when the operator passes nothing.
- **`Drivers.Declare`** authors a *soft* default. Operator `-d`/`-D` always wins,
  so this says "postgres unless told otherwise" rather than locking anything in.
- **`QueryValue[int64]`** is a read, and it is checked. `b.Exec` would send the
  same statement and throw the answer away — see
  [Exec or read](#exec-or-read).

### Test it without a database

`pkg/bench/testkit` runs the real runtime against the recording driver, so the
workload's own tests need no server:

```go
func runOnce(t *testing.T, reply *record.Response) uint64 {
    t.Helper()

    recorder := &record.Recorder{}
    if reply != nil {
        recorder.Reply(selectOne, *reply)
    }

    run, err := testkit.Record(t.Context(), Test, recorder, bench.RunOptions{
        Params: bench.ParamInputs{CLI: map[string]string{"iterations": "1"}},
    })
    if err != nil {
        t.Fatal(err)
    }

    recorded := recorder.Operations()
    if len(recorded) != 1 {
        t.Fatalf("expected one query, recorded %d", len(recorded))
    }

    if recorded[0].SQL != selectOne {
        t.Fatalf("recorded SQL %q, want %q", recorded[0].SQL, selectOne)
    }

    return run.Errors.FailedIterations
}
```

Then three assertions, two of which exist to prove the check is live:

```go
func TestSelectOneAcceptsTheAnswer(t *testing.T) {
    if failed := runOnce(t, &record.Response{
        Columns: []string{"?column?"}, Rows: [][]any{{int64(1)}},
    }); failed != 0 {
        t.Fatalf("failed iterations = %d; want 0", failed)
    }
}

func TestSelectOneRejectsAWrongAnswer(t *testing.T) {
    if failed := runOnce(t, &record.Response{
        Columns: []string{"?column?"}, Rows: [][]any{{int64(2)}},
    }); failed != 1 {
        t.Fatalf("failed iterations = %d; want 1 — the answer check is not live", failed)
    }
}

func TestSelectOneRejectsNoAnswer(t *testing.T) {
    if failed := runOnce(t, nil); failed != 1 {
        t.Fatalf("failed iterations = %d; want 1 — a missing row must fail the iteration", failed)
    }
}
```

`run.Errors.FailedIterations` is the honest measure. An ordinary action error
counts a failed iteration and lets other workers continue, so a test that only
checks `err == nil` would pass while every iteration failed.

```bash
go test ./...
# ok  	example.com/select1/workload
```

### Run it

Standalone, overriding the declared default on the command line:

```bash
go run . -d pg -D url='postgres://user@localhost:5432/postgres' --iterations 5
```

```text
  iterations_total                         5.000
  failed_iterations_total                  0.000
```

No database handy? `pg-noop` speaks the PostgreSQL wire protocol on loopback and
stores nothing — see [Baseline](./baseline) for how it is fetched and run:

```bash
"$PGNOOP" --host 127.0.0.1 --port 5439 &
go run . -d pg -D url='postgres://stroppy@127.0.0.1:5439/postgres?sslmode=disable' --iterations 5
```

Harness overhead alone, with no server at all:

```bash
go run . -d noop --iterations 5
```

### Register it

Run `build` from inside the project — this is the documented flow:

```bash
$ stroppy build .
runtime c1c165709e3b: sdk module github.com/stroppy-io/stroppy/v6 v6.1.1-55-g1bafc12
select1	1b788224feee…	c1c165709e3b…	true
```

The first line (stderr) names the SDK that runtime was compiled against; the
second reports `name`, snapshot digest, runtime digest, and whether the artifact
was reused. From here the project directory is optional:

```bash
stroppy run select1 -D url='postgres://user@localhost:5432/postgres' --iterations 5
stroppy list                      # select1   custom
stroppy run select1 --help        # usage, static flags, run parameters, steps
stroppy probe select1 -o json     # declared defaults, steps, driver references
```

## Sample 2: `selectfile`

Now move the statement into a file and give the workload parameters.

### The SQL file

`workload/queries.sql`:

```sql
--+ query
--= select_one
SELECT 1
```

`--+ name` opens a section and `--= name` opens a named query inside it. The
workload asks for `query/select_one` by name, so a replacement file must define
the same pair. Put `--+ query` first: text before the first section marker is
ignored. See [SQL & Generators](./sql-and-generators) for the full grammar.

### The workload

```go
package workload

import (
    "context"
    "embed"
    "fmt"

    "github.com/stroppy-io/stroppy/v6/pkg/bench"
)

//go:embed *.go LICENSE README.md queries.sql
var source embed.FS

const queryFile = "queries.sql"

var Test = bench.Test{Name: "selectfile", Define: define, Source: source, SourcePackage: "example.com/selectfile/workload"}

func init() { bench.Register(Test) }

type workload struct {
    handle   bench.QueryHandle
    expected int64
    label    string
}

func define(d *bench.Def) error {
    run := bench.RunParameters(&d.Param, bench.RunDefaults{Iterations: 1})

    w := &workload{}
    w.expected, _ = d.Param.Int64("expected", 1, "Answer the loaded statement must return.", bench.Min(int64(0)))
    w.label, _ = d.Param.String("label", "selectfile", "Value copied into the run report data.")
    sqlFile, _ := d.Param.String("sql-file", "", "SQL file to load instead of the embedded one.")

    queries, err := loadQueries(d, sqlFile)
    if err != nil {
        return err
    }

    w.handle = queries.Require("query", "select_one")

    d.Drivers.Declare("default", bench.DriverConfig{Kind: bench.DriverPostgres})
    d.Execution.Step("query", w.query, run.Policy())

    return d.Execution.Err()
}

func loadQueries(d *bench.Def, sqlFile string) (*bench.SQL, error) {
    if sqlFile != "" {
        return d.Queries.Override(sqlFile)
    }

    return d.Queries.Load(source, queryFile)
}

func (w *workload) query(ctx context.Context, b *bench.Bench) error {
    b.AddReportData("label", w.label)

    value, err := b.QueryValue[int64](ctx, w.handle.Text, nil)
    if err != nil {
        return err
    }

    if value != w.expected {
        return fmt.Errorf("%s returned %d, want %d", w.handle.Name, value, w.expected)
    }

    return nil
}
```

What is new here:

- **`//go:embed … queries.sql`** publishes the asset with the package, so the
  registered workload carries its SQL and needs no source tree at run time.
- **`d.Param.Int64` / `String`** return a value plus its provenance. A canonical
  kebab-case name projects to three channels automatically:

  | Channel | Example |
  |---|---|
  | flag | `--expected 2` |
  | environment | `EXPECTED=2` |
  | config | `{"params": {"expected": 2}}` |

  Precedence is typed CLI > process environment > matching typed config >
  declared default, and a malformed supplied value fails rather than falling
  back to the default. `bench.Min(int64(0))` rejects nonsense before any action
  runs; see [Config file](./config-file) for the envelope.
- **`d.Queries.Load(source, queryFile)`** searches the working directory first,
  then `~/.stroppy/`, then the embedded filesystem; `Override` reads only the
  named file. That is how an operator tries a variant without rebuilding.
- **Declaring `sql-file` is what makes the positional work.** The file must sit
  next to the workload name, before any flag:

  ```bash
  stroppy run selectfile my-queries.sql -D url='…'   # bound to --sql-file
  stroppy run selectfile -D url='…' my-queries.sql   # rejected: must be adjacent
  ```

- **State lives in ordinary Go.** The struct is created in `Define`, so each
  worker owns its own copy and no framework object is retained.

### Test it

The same recording harness, with the workload's parameters threaded through. These
are the helpers from the sample's `workload_test.go`, so the calls below compile as
written:

```go
// runOnce executes the workload once against a canned answer for the loaded
// statement and returns how many iterations failed.
func runOnce(t *testing.T, params map[string]string, reply *record.Response) uint64 {
    t.Helper()

    recorder := &record.Recorder{}
    if reply != nil {
        recorder.Reply("SELECT 1", *reply)
    }

    run, err := testkit.Record(t.Context(), Test, recorder, bench.RunOptions{
        Params: bench.ParamInputs{CLI: params},
    })
    if err != nil {
        t.Fatal(err)
    }

    recorded := recorder.Operations()
    if len(recorded) != 1 {
        t.Fatalf("expected one query, recorded %d", len(recorded))
    }

    if recorded[0].SQL != "SELECT 1" {
        t.Fatalf("recorded SQL %q, want the query loaded from %s", recorded[0].SQL, queryFile)
    }

    return run.Errors.FailedIterations
}

func oneRow(value int64) *record.Response {
    return &record.Response{Columns: []string{"?column?"}, Rows: [][]any{{value}}}
}
```

Then the expectations, including the one that proves `--expected` is wired up:

```go
func TestEmbeddedQuerySatisfiesTheDefaultExpectation(t *testing.T) {
    if failed := runOnce(t, nil, oneRow(1)); failed != 0 {
        t.Fatalf("failed iterations = %d; want 0", failed)
    }
}

func TestExpectedParameterIsChecked(t *testing.T) {
    if failed := runOnce(t, map[string]string{"expected": "1"}, oneRow(1)); failed != 0 {
        t.Fatalf("failed iterations = %d; want 0", failed)
    }

    if failed := runOnce(t, map[string]string{"expected": "2"}, oneRow(1)); failed != 1 {
        t.Fatalf("failed iterations = %d; want 1 — --expected is not checked", failed)
    }
}
```

### Run and inspect it

```bash
$ go run . -d pg -D url='postgres://user@localhost:5432/postgres' --expected 2 --iterations 3
  failed_iterations_total                  3.000

=== bench completed with errors ===
```

A wrong expectation is a *nonfatal* failure: the run reports bounded error
groups and still exits 0, because other iterations may be fine. Setup,
validation, teardown, and fatal errors are what produce a nonzero exit — see
[Transactions](./transactions) for the retry and terminal-error policy.

The label reaches the report envelope:

```bash
stroppy run selectfile -D url='…' --label nightly --iterations 1 --report-format json
```

```json
"custom": {"label": "nightly"},
"parameters": {"workload": {"expected": {"value": 1}, "label": {"value": "nightly"}}}
```

A replacement file that lacks the required query fails before any action runs:

```text
Error: failed to run go workload: define "selectfile": query: invalid author input: missing required query query/select_one
```

## Exec or read

- `b.Exec(ctx, sql, args)` runs a statement and discards rows. Use it for DDL,
  DML, and statements whose result you deliberately do not care about.
- `b.QueryValue[T]`, `b.QueryValues[T]`, `b.Query`, and `b.QueryRow` read. This
  is where a benchmark earns its name: an iteration that checks the answer fails
  when the database is wrong instead of silently measuring a machine that
  answers nothing.
- The `noop` driver returns no rows at all, so a checked workload needs a real
  driver or pg-noop. The workload's own tests use the recording driver, which
  has no such limitation.

## Register, list, package

```bash
stroppy build .                 # register (from inside the project)
stroppy build --replace .       # after editing
stroppy list                    # built-in and custom workloads
stroppy export select1 -o ./stroppy-select1   # portable binary
stroppy cache inspect DIGEST    # build provenance, including which SDK it used
stroppy remove select1          # unregister
```

`Test.Source` is what makes `stroppy eject select1 ./copy` able to restore your
project — code, SQL, and tests — somewhere else, with imports rewritten to the
new module path. Leave it nil and the workload still runs; only ejection is
unavailable, and `stroppy eject` says so.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `unknown workload … "select1"` | Not registered, or a different `~/.stroppy`. Run `stroppy build .` in the project, then `stroppy list`. |
| Every iteration fails with `query returned no rows` | A checked read under the `noop` driver. Point at a database or pg-noop. |
| `missing required query query/select_one` | The loaded SQL file does not define that section/query pair. |
| Changes to `*.sql` have no effect | The embedded snapshot is stale: `stroppy build --replace .`. Passing the file positionally loads it from the working directory instead. |
| `unexpected positional argument after options` | The SQL file must be adjacent to the workload name, before the flags. |
| `conflicting local module replacements for <module>` | Two catalog entries came from one module path — usually after renaming the `Test` in a project you already built. `stroppy list`, then `stroppy remove` the stale name. |
| A workload name is refused | `build`, `cache`, `export`, `help`, `init`, `eject`, `list`, `probe`, `remove`, `run`, `version`, and `completion` are reserved. |

## Where next

- [Extensibility](./extensibility) — the packages and interfaces behind the
  authoring surface.
- [SQL & Generators](./sql-and-generators) — section/query grammar and typed
  row generation for loads.
- [Drivers](./drivers) — presets, pools, TLS, insert capabilities, and error
  classification.
- [Reports workflow](./reports-workflow) — summaries, JSON reports, OTLP, and
  benchmarking practice.
