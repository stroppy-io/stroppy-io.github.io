---
sidebar_position: 4
title: Transactions
description: Using database transactions with configurable isolation levels
---

# Transactions

Stroppy wraps database transactions in a TypeScript API that handles isolation levels, automatic commit/rollback, metrics collection, and error propagation. You can use transactions manually or with a callback that manages the lifecycle for you.

## Quick Start

The fastest way to use a transaction is the callback form &mdash; `beginTx` starts a transaction, runs your function, commits on success, and rolls back on error:

```typescript
driver.beginTx((tx) => {
  tx.exec("UPDATE accounts SET balance = balance - :amount WHERE id = :src", {
    src: 1, amount: 100,
  });
  tx.exec("UPDATE accounts SET balance = balance + :amount WHERE id = :dst", {
    dst: 2, amount: 100,
  });
});
// committed automatically
```

If anything inside the callback throws, the transaction is rolled back and the error is re-thrown.

## `begin()` vs `beginTx()`

Stroppy provides two ways to work with transactions.

### `beginTx(fn)` &mdash; callback form (recommended)

`beginTx` opens a transaction, calls your function with a `TxX` object, and commits when the function returns. If the function throws, the transaction is rolled back and the error propagates:

```typescript
driver.beginTx((tx) => {
  tx.exec("INSERT INTO orders (product, qty) VALUES (:p, :q)", {
    p: "widget", q: 5,
  });
  // auto-commit on return
});
```

You can pass options before the callback:

```typescript
driver.beginTx({ isolation: "serializable", name: "transfer" }, (tx) => {
  tx.exec("UPDATE accounts SET balance = balance - 100 WHERE id = 1");
  tx.exec("UPDATE accounts SET balance = balance + 100 WHERE id = 2");
});
```

### `begin()` &mdash; manual form

`begin()` returns a `TxX` object. You are responsible for calling `commit()` or `rollback()`:

```typescript
const tx = driver.begin({ isolation: "read_committed" });
try {
  tx.exec("INSERT INTO log (msg) VALUES (:m)", { m: "started" });
  tx.exec("INSERT INTO log (msg) VALUES (:m)", { m: "finished" });
  tx.commit();
} catch (e) {
  tx.rollback();
  throw e;
}
```

The callback form is preferred for most cases because it eliminates the risk of forgetting to commit or rollback.

## Isolation Levels

Set the isolation level when starting a transaction:

```typescript
driver.begin({ isolation: "serializable" });
driver.beginTx({ isolation: "repeatable_read" }, (tx) => { /* ... */ });
```

### Available levels

| Level | Behavior |
|-------|----------|
| `"read_uncommitted"` | Allows dirty reads. Lowest isolation. |
| `"read_committed"` | Each statement sees only committed data. PostgreSQL default. |
| `"repeatable_read"` | Snapshot at transaction start. No phantom reads in PostgreSQL. |
| `"serializable"` | Full serializability. Highest isolation. |
| `"db_default"` | Uses the database server's default isolation. This is Stroppy's default if nothing else is configured. |
| `"conn"` | Acquires a dedicated connection **without** starting a database transaction. See [below](#the-conn-level). |
| `"none"` | No transaction, no connection pinning. Queries go through the connection pool directly. See [below](#the-none-level). |

### The `"conn"` level

`"conn"` acquires a dedicated connection from the pool but does **not** issue `BEGIN`. This is useful for session-level operations that need a pinned connection &mdash; for example, setting session variables, using advisory locks, or working with databases that do not support transactions.

```typescript
driver.beginTx({ isolation: "conn" }, (tx) => {
  tx.exec("SET search_path TO my_schema");
  tx.exec("SELECT pg_advisory_lock(:id)", { id: 42 });
  // ... work on the pinned connection ...
  tx.exec("SELECT pg_advisory_unlock(:id)", { id: 42 });
});
// connection is returned to the pool on commit/rollback
```

Under the hood, `commit()` and `rollback()` both simply release the connection back to the pool &mdash; there is no `COMMIT` or `ROLLBACK` SQL sent.

### The `"none"` level

`"none"` creates a lightweight `TxX` wrapper with no underlying transaction and no connection pinning. Every query goes directly through the driver's connection pool, just like calling `driver.exec()`. Commit and rollback are no-ops.

This is useful when you want transaction-shaped code (with metrics and error tracking) but do not need actual transactional guarantees:

```typescript
driver.beginTx({ isolation: "none" }, (tx) => {
  tx.exec("INSERT INTO events (type) VALUES (:t)", { t: "click" });
  // this insert is visible to other connections immediately
});
```

## Default Isolation Level

Instead of passing `isolation` on every call, set a default for the driver:

### In `declareDriverSetup`

```typescript
const driverConfig = declareDriverSetup(0, {
  url: "postgres://localhost:5432/mydb",
  driverType: "postgres",
  defaultTxIsolation: "read_committed",
});

const driver = DriverX.create().setup(driverConfig);

// All transactions now use read_committed unless overridden:
driver.beginTx((tx) => {
  tx.exec("SELECT 1"); // read_committed
});
driver.beginTx({ isolation: "serializable" }, (tx) => {
  tx.exec("SELECT 1"); // serializable (override)
});
```

### From the CLI

Override the script default with the `-D` flag:

```bash
stroppy run my_test.ts -D defaultTxIsolation=serializable
```

The precedence is: per-call `isolation` option > CLI `-D defaultTxIsolation` > script `declareDriverSetup` > built-in default (`"db_default"`).

## The `TxX` API

`TxX` implements the same `QueryAPI` interface as `DriverX`, so you can use all the same query methods inside a transaction:

| Method | Description |
|--------|-------------|
| `tx.exec(sql, args?)` | Execute a query, return `QueryStats`. |
| `tx.queryRows(sql, args?, limit?)` | Execute a query, return all rows as `any[][]`. |
| `tx.queryRow(sql, args?)` | Return the first row or `undefined`. |
| `tx.queryValue<T>(sql, args?)` | Return the first column of the first row, or `undefined`. |
| `tx.queryCursor(sql, args?)` | Return a `QueryResult` cursor for streaming. |
| `tx.commit()` | Commit the transaction. |
| `tx.rollback()` | Rollback the transaction. |

Additionally, `TxX` exposes two read-only properties:

| Property | Type | Description |
|----------|------|-------------|
| `tx.isolation` | `TxIsolationName` | The isolation level this transaction was started with. |
| `tx.name` | `string \| undefined` | The optional name passed at creation (used in metric tags). |

All query methods (`exec`, `queryRows`, etc.) accept raw SQL strings, `ParsedQuery` objects from structured SQL files, and `TaggedQuery` objects &mdash; same as on `DriverX`.

## Error Handling in Transactions

Inside a transaction, query errors behave differently than outside one:

- **Outside a transaction**: The driver's error mode (`"silent"`, `"log"`, `"throw"`, `"fail"`, `"abort"`) controls what happens on error.
- **Inside a transaction**: Errors always **throw**, regardless of the configured error mode. This ensures that a failing query triggers the rollback path in `beginTx`, rather than being silently swallowed.

When using `beginTx`, the thrown error causes an automatic rollback and then re-propagates to the caller:

```typescript
try {
  driver.beginTx((tx) => {
    tx.exec("INSERT INTO t VALUES (1)"); // succeeds
    tx.exec("INSERT INTO t VALUES (1)"); // unique violation — throws
  });
} catch (e) {
  // transaction was rolled back automatically
  // e contains the original database error
}
```

When using `begin()` manually, you must catch errors yourself and call `rollback()`.

### Interaction with `"fail"` and `"abort"` error modes

The `"fail"` and `"abort"` error modes (set via `errorMode` in driver config or the `STROPPY_ERROR_MODE` env var) affect what happens **after** the transaction error propagates out of `beginTx`:

- `"fail"` &mdash; Marks the current k6 iteration as failed via `test.fail()`. The VU moves on to the next iteration.
- `"abort"` &mdash; Aborts the entire test run via `test.abort()`.

Inside the transaction itself, however, the error always throws so the rollback can execute first.

## Transaction Metrics

Stroppy automatically tracks several metrics for every transaction:

| Metric | Type | Description |
|--------|------|-------------|
| `tx_total_duration` | Trend (ms) | Wall-clock time from `begin()` to `commit()`/`rollback()`. |
| `tx_clean_duration` | Trend (ms) | Sum of actual query execution times within the transaction (excludes time spent in TypeScript between queries). |
| `tx_commit_rate` | Rate | Fraction of transactions that committed (vs rolled back). |
| `tx_error_rate` | Rate | Fraction of `beginTx` calls that threw an error. |
| `tx_queries_per_tx` | Trend | Number of queries executed within each transaction. |

Individual queries within a transaction also contribute to the standard `run_query_duration`, `run_query_count`, and `run_query_error_rate` metrics.

### Metric tags

All transaction metrics are tagged with:

- `tx_action` &mdash; `"commit"` or `"rollback"`
- `tx_name` &mdash; The name you passed (if any)
- `tx_isolation` &mdash; The isolation level string

This lets you filter and group metrics by transaction type in dashboards and reports:

```typescript
driver.beginTx({ isolation: "serializable", name: "transfer" }, (tx) => {
  // metrics for this tx will carry tags:
  //   tx_action: "commit"
  //   tx_name: "transfer"
  //   tx_isolation: "serializable"
  tx.exec("UPDATE accounts SET balance = balance - :amt WHERE id = :src", {
    src: 1, amt: 50,
  });
  tx.exec("UPDATE accounts SET balance = balance + :amt WHERE id = :dst", {
    dst: 2, amt: 50,
  });
});
```

## Full Example

Here is a complete test script that creates a table, runs transactional inserts, and verifies results:

```typescript
import { Options } from "k6/options";
import { Teardown } from "k6/x/stroppy";
import { DriverX, R, declareDriverSetup } from "./helpers.ts";

export const options: Options = {
  iterations: 1,
  vus: 1,
};

const driverConfig = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
  defaultTxIsolation: "read_committed",
});

const driver = DriverX.create().setup(driverConfig);

const aidGen = R.int32(1, 100000).gen();
const deltaGen = R.int32(-500, 500).gen();

export function setup() {
  driver.exec("DROP TABLE IF EXISTS accounts");
  driver.exec(`
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0
    )
  `);
  driver.exec("INSERT INTO accounts (id, balance) VALUES (1, 1000)");
  driver.exec("INSERT INTO accounts (id, balance) VALUES (2, 1000)");
}

export default function () {
  // Callback form — auto-commit on success, auto-rollback on error
  driver.beginTx({ isolation: "serializable", name: "transfer" }, (tx) => {
    const delta = deltaGen.next();
    tx.exec("UPDATE accounts SET balance = balance - :d WHERE id = 1", { d: delta });
    tx.exec("UPDATE accounts SET balance = balance + :d WHERE id = 2", { d: delta });

    // Verify invariant inside the transaction
    const total = tx.queryValue<number>(
      "SELECT SUM(balance) FROM accounts",
    );
    if (total !== 2000) {
      throw new Error(`balance invariant violated: ${total}`);
    }
  });
}

export function teardown() {
  Teardown();
}
```

## Go Driver Side

On the Go side, the `Driver` interface exposes a single method for starting transactions:

```go
type Driver interface {
    Begin(ctx context.Context, isolation stroppy.TxIsolationLevel) (Tx, error)
    RunQuery(ctx context.Context, sql string, args map[string]any) (*QueryResult, error)
    InsertValues(ctx context.Context, unit *stroppy.InsertDescriptor) (*stats.Query, error)
    Teardown(ctx context.Context) error
}
```

The returned `Tx` interface provides:

```go
type Tx interface {
    RunQuery(ctx context.Context, sql string, args map[string]any) (*QueryResult, error)
    Commit(ctx context.Context) error
    Rollback(ctx context.Context) error
    Isolation() stroppy.TxIsolationLevel
}
```

For the `CONNECTION_ONLY` level, each driver acquires a raw connection from the pool and wraps it in a `ConnOnlyTx` &mdash; where `Commit()` and `Rollback()` both release the connection without sending any SQL. For the `NONE` level, the xk6 bridge creates a thin wrapper where `RunQuery` delegates directly to the driver's pool-level `RunQuery`, and `Commit`/`Rollback` are no-ops.

Custom driver implementations only need to handle the standard four SQL isolation levels plus `CONNECTION_ONLY` &mdash; the `NONE` level is handled by the runtime before reaching the driver.
