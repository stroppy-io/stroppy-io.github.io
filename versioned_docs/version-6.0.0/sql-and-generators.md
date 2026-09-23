---
sidebar_position: 3
title: SQL & Generators
description: Structured SQL, named parameters, local overrides, and deterministic typed Go generation
---

# SQL & Generators

Stroppy v6 separates SQL text from Go workload behavior. Built-in workload
packages own their dialect SQL files and deterministic row sources; the binary
embeds both.

You can also run arbitrary SQL files or inline SQL directly.

## Named parameters

Write parameters as `:name`:

```sql
UPDATE accounts
SET balance = balance + :delta
WHERE id = :account_id
```

The driver converts them to native placeholders (`$1`, `$2`, ... for
PostgreSQL-like dialects; `?` for MySQL) and binds values separately from SQL
text.

Repeated names are deduplicated where the dialect supports it. PostgreSQL casts
remain distinct from parameters:

```sql
SELECT :value::bigint + :increment::bigint
```

Workload Go code supplies an argument map:

```go
args := map[string]any{
    "account_id": int64(42),
    "delta":      int64(100),
}
if err := b.Exec(ctx, query, args); err != nil {
    return err
}
```

Missing arguments are errors. Bound values are converted by the selected
dialect before execution.

## Structured SQL files

Two comment markers divide files into sections and queries:

```sql
--+ drop_schema
--= accounts
DROP TABLE IF EXISTS accounts;

--+ create_schema
--= accounts
CREATE TABLE accounts (
    id BIGINT PRIMARY KEY,
    balance BIGINT NOT NULL
);

--+ workload_tx_transfer
--= debit
UPDATE accounts SET balance = balance - :amount WHERE id = :source_id;
--= credit
UPDATE accounts SET balance = balance + :amount WHERE id = :target_id;
```

| Marker | Meaning |
|---|---|
| `--+ section_name` | Begin named section. |
| `--= query_name` | Begin named query inside current section. |
| `--=` | Begin unnamed query, useful for ordered setup lists. |

Section/query names are lookup keys for Go code, not SQL identifiers.

Full-line `--` comments inside query bodies are stripped before SQL reaches the
database. Use `/* ... */` when a procedure body must retain a comment, except at
statement head on Picodata where sbroad rejects block comments.

## Built-in dialect assets

TPC-B, TPC-C, and TPC-H ship:

```text
workloads/<name>/pg.sql
workloads/<name>/mysql.sql
workloads/<name>/pico.sql
workloads/<name>/ydb.sql
```

TPC-DS also owns per-dialect schema files:

```text
schema.pg.sql
schema.mysql.sql
schema.pico.sql
schema.ydb.sql
```

A workload selects assets by `driverType`. Section and named-query contracts
remain consistent across supported dialects while SQL text changes for backend
syntax.

Inspect embedded asset names:

```bash
stroppy probe
stroppy probe -o json
```

## SQL override and rebuild rules

Explicit local paths resolve from the current directory before embedded assets:

```bash
stroppy run tpcc/tx ./workloads/tpcc/pico.sql -d pico
```

This is the fastest SQL edit/run loop: no rebuild required.

Short names may resolve to embedded snapshots:

```bash
stroppy run tpcc/tx tpcc/pico -d pico
```

Edits to `workloads/<name>/*.sql` on disk do not alter an already-built embedded
snapshot. Rebuild Stroppy before testing a short embedded name:

```bash
make build
```

Resolution order:

1. current working directory;
2. `~/.stroppy/`;
3. embedded assets.

## Direct SQL mode

A `.sql` first positional selects `execute_sql` automatically:

```bash
stroppy run ./queries.sql -d pg
```

Inline SQL must contain whitespace so it is distinguishable from a registered
name:

```bash
stroppy run "select current_timestamp" -d pg
```

`execute_sql` accepts `--sql-file` and `--sql-body`, along with shared executor
flags. It records each failed query, continues through a query set when the
error is nonfatal, and summarizes terminal errors at the end.

## Typed Go generation

Built-in relational loads use `driver.InsertRequest`:

```go
type InsertRequest struct {
    Table   string
    Method  InsertMethod
    Workers int
    Source  gen.BatchSource
}
```

A workload:

1. builds a typed schema;
2. fills reusable batches from a row function or canonical generator;
3. hands the source and insert method to `Bench.Insert`;
4. lets the driver split deterministic entity ranges among workers.

Condensed indexed-source shape:

```go
root := gen.New(seed)
domain := root.Domain("accounts@1")
valueField := domain.Field("balance")

builder := gen.NewSchemaBuilder()
id := builder.Int64("id")
balance := builder.Int64("balance")
schema := builder.Build()

source := gen.NewIndexedSource(
    schema,
    root,
    "accounts@1",
    rows,
    batchRows,
    func(row gen.Row, entity uint64) error {
        row.SetInt64(id, int64(entity)+1)
        row.SetInt64(balance, valueField.Int64(entity, -1000, 1000))
        return nil
    },
)

_, err := b.Insert(ctx, &driver.InsertRequest{
    Table:   "accounts",
    Method:  driver.InsertPlainBulk,
    Workers: loadWorkers,
    Source:  source,
})
```

Reusable primitives live in `pkg/gen`. Values derive from run seed, versioned
domain, field name, and entity index. They are deterministic across worker
counts, batch sizes, and partition boundaries.

Canonical adapters preserve upstream algorithms and seeds:

- `pkg/datagen/tpchgen` wraps the retained dbgen implementation;
- `pkg/datagen/tpcdsgen` wraps the retained dsdgen implementation;
- `pkg/datagen/source` defines the row-source seam used by drivers.

## Parallel loading

Workloads exposing `--load-workers` pass it through each insert request:

```bash
stroppy run tpcc/tx -d pg --load-workers 8 \
  --steps drop_schema,create_schema,load_data
```

Each worker receives a contiguous entity range and prepares its own cursor.
Stateful TPC adapters seek directly to partition starts, preserving generated
rows without replaying earlier entities.

See the pinned
[v6 parallelism contract](https://github.com/stroppy-io/stroppy/blob/v6.0.0/docs/parallelism.md)
for authoring and tuning details.

## Insert methods

| Name | Typical path |
|---|---|
| `plain_query` | One-row INSERT batches. |
| `plain_bulk` | Multi-row INSERT. |
| `columnar` | PostgreSQL array/`unnest`; YDB redirects to BulkUpsert. |
| `native` | PostgreSQL COPY, YDB BulkUpsert, CSV files, or driver equivalent. |

Use `stroppy probe` for the exact per-driver capability list.

## CSV generation

CSV is a typed-load sink with no query path:

```bash
stroppy run tpcb/tx \
  -D driverType=csv \
  -D url='/tmp/tpcb-csv?merge=true&workload=tpcb' \
  --steps drop_schema,create_schema,load_data
```

It publishes shards, merged files, and manifests atomically. Failed/canceled
loads keep recoverable shards without presenting partial output as complete.

## Adding generation logic

V6 does not execute workload source files dynamically. Add a custom generator
inside a Go workload package, register its `bench.Workload` factory, and rebuild
the binary. See [Extensibility](./extensibility).
