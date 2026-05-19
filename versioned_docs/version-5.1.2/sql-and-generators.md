---
sidebar_position: 2
title: SQL & Generators
description: Parameterized SQL, structured SQL files, and relational data generation
---

# SQL & Generators

Stroppy workload scripts usually combine two things: SQL execution with named parameters, and deterministic relational data generation through InsertSpec.

## Parameterized Queries

### The `:param` syntax

Stroppy uses `:paramName` syntax for query parameters. Drivers convert these to native placeholders at execution time, such as `$1`, `$2` for PostgreSQL and `?` for MySQL.

```typescript
driver.exec("SELECT :value + :second", {
  value: 100,
  second: 50,
});
```

Parameters are deduplicated where the dialect supports it:

```typescript
driver.exec("SELECT :x + :x", { x: 42 });
```

PostgreSQL casts work at runtime because the execution parser distinguishes `:param` from `::` casts:

```typescript
driver.exec("SELECT :a::int + :b::int", { a: 34, b: 35 });
```

The SQL metadata parser used by `parse_sql` is intentionally simpler; if you inspect `ParsedQuery.params` for PostgreSQL-heavy SQL, verify casts in probe output.

### Query API

Both `DriverX` and `TxX` implement the same query API:

```typescript
interface QueryAPI {
  exec(sql, args?): QueryStats;
  queryRows(sql, args?, limit?): any[][];
  queryRow(sql, args?): any[] | undefined;
  queryValue<T>(sql, args?): T | undefined;
  queryCursor(sql, args?): QueryResult | undefined;
}
```

All query methods accept a raw SQL string, a `ParsedQuery` from `parse_sql`, or a tagged query object.

```typescript
const count = driver.queryValue<number>("SELECT count(*) FROM users");
const row = driver.queryRow("SELECT id, name FROM users WHERE id = :id", { id: 1 });
const rows = driver.queryRows("SELECT id, name FROM users LIMIT :n", { n: 10 });
```

### Argument validation

Missing parameters are errors. Extra keys currently produce a warning and are ignored for execution.

```typescript
driver.exec("SELECT :a", {});              // error: missed argument a
driver.exec("SELECT :a", { a: 1, b: 2 });  // warning: extra argument b
```

## Structured SQL Files

For larger workloads, Stroppy supports SQL files with named sections and named queries.

```sql
--+ drop_schema
--= accounts
DROP TABLE IF EXISTS accounts CASCADE;

--+ create_schema
--= accounts
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  balance INTEGER NOT NULL
);

--+ workload
--= debit
UPDATE accounts SET balance = balance - :amount WHERE id = :id;
```

Markers:

| Marker | Meaning |
|--------|---------|
| `--+ name` | Starts a new section. |
| `--= name` | Names the next query in the current section. |
| `--=` | Starts an unnamed query. Useful when the script iterates a section in order. |

### Using sections in TypeScript

```typescript
import { parse_sql_with_sections } from "./parse_sql.js";

const sql = parse_sql_with_sections(open(__ENV.SQL_FILE));

export function setup() {
  sql("drop_schema").forEach((query) => driver.exec(query, {}));
  sql("create_schema").forEach((query) => driver.exec(query, {}));
}

export default function () {
  driver.exec(sql("workload", "debit")!, { id: 1, amount: 50 });
}
```

For flat files without `--+` sections, use `parse_sql`:

```typescript
import { parse_sql } from "./parse_sql.js";

const queries = parse_sql(open(__ENV.SQL_FILE));

queries();              // ParsedQuery[]
queries("my_query");    // ParsedQuery | undefined
```

Each `ParsedQuery` has:

| Field | Description |
|-------|-------------|
| `name` | Query name from `--=`. |
| `sql` | Raw SQL text. |
| `type` | `CreateTable`, `Insert`, `Select`, `Other`, or `Invalid`. |
| `params` | Extracted parameter names. |

## Multi-Dialect SQL

Built-in workloads that support multiple databases ship one SQL file per dialect. The TypeScript script selects the file based on the active `driverType`:

```typescript
const _sqlByDriver: Record<string, string> = {
  postgres: "./pg.sql",
  mysql: "./mysql.sql",
  picodata: "./pico.sql",
  ydb: "./ydb.sql",
};

const SQL_FILE = ENV("SQL_FILE", ENV.auto, "SQL file path")
  ?? _sqlByDriver[driverConfig.driverType!]
  ?? "./pg.sql";
```

The section and query names must match across dialect files because the TypeScript workload references those names independent of the database.

You can force a variant with the second positional SQL argument:

```bash
stroppy run tpcc/tx tpcc/pico -d pico
stroppy run tpch/tx tpch/mysql -d mysql
```

## Relational Data Generation

Stroppy's current load path is InsertSpec: a TypeScript table declaration serialized to protobuf and streamed through the selected driver.

Import the builders from `datagen.ts`:

```typescript
import {
  Alphabet,
  Attr,
  Draw,
  DrawRT,
  Expr,
  InsertMethod,
  Rel,
} from "./datagen.ts";
```

A table load is declared with `Rel.table` and executed with `driver.insertSpec(...)`:

```typescript
const accounts = Rel.table("accounts", {
  size: 100_000,
  seed: 0xA11CE,
  method: InsertMethod.NATIVE,
  parallelism: LOAD_WORKERS || undefined,
  attrs: {
    aid: Attr.rowId(),
    bid: Expr.add(
      Expr.div(Attr.rowIndex(), Expr.lit(100_000)),
      Expr.lit(1),
    ),
    balance: Expr.lit(0),
    filler: Draw.ascii({
      min: Expr.lit(84),
      max: Expr.lit(84),
      alphabet: Alphabet.en,
    }),
  },
});

Step("load_data", () => {
  driver.insertSpec(accounts);
});
```

Generated values are deterministic functions of the table seed, attribute path, and row index. This makes loads reproducible and lets drivers split a table into independent parallel chunks.

### Core builders

| Builder | Use |
|---------|-----|
| `Rel.table(name, spec)` | Declares one table InsertSpec. |
| `Attr.rowId()` | 1-based row id derived from the row index. |
| `Attr.rowIndex()` | 0-based row index expression. |
| `Attr.lookup(...)` | Reads from another generated population. |
| `Expr.lit(value)` | Literal value expression. |
| `Expr.add`, `Expr.sub`, `Expr.mul`, `Expr.div` | Arithmetic expressions. |
| `Expr.if`, `Expr.choose` | Conditional and weighted-choice expressions. |
| `Draw.*` | Deterministic load-time distributions. |
| `DrawRT.*` | Transaction-time random generators for workload code. |

### Insert methods

| Method | Meaning |
|--------|---------|
| `InsertMethod.NATIVE` | Driver-native fast path: PostgreSQL COPY, YDB BulkUpsert, CSV output, Noop drain, or driver-specific equivalent. |
| `InsertMethod.PLAIN_BULK` | Multi-row INSERT batches. |
| `InsertMethod.PLAIN_QUERY` | Per-row INSERT path, implemented as batch size 1 where possible. |

Driver configuration can pin every InsertSpec to a method with `defaultInsertMethod`:

```typescript
const driverConfig = declareDriverSetup(0, {
  driverType: "postgres",
  url: "postgres://postgres:postgres@localhost:5432",
  defaultInsertMethod: "native",
});
```

## Runtime Draws

Use `DrawRT` for transaction-time randomness inside the workload loop. Construct the generator at init time and call `.next()` inside the exported function.

```typescript
declare const __VU: number;

const vu = typeof __VU === "number" ? __VU : 0;
const aidGen = DrawRT.intUniform(0xA11CE ^ vu, 1, 100_000);
const deltaGen = DrawRT.intUniform(0xD317A ^ vu, -5000, 5000);

export default function () {
  driver.beginTx((tx) => {
    tx.exec("UPDATE accounts SET balance = balance + :d WHERE aid = :a", {
      a: aidGen.next(),
      d: deltaGen.next(),
    });
  });
}
```

## TPC-B Example

This condensed example mirrors the current `tpcb/tx` style: structured SQL for schema and transaction statements, InsertSpec for loading, and `DrawRT` for hot-loop parameters.

```typescript
import { Options } from "k6/options";
import { Teardown } from "k6/x/stroppy";
import { DriverX, ENV, Step, declareDriverSetup } from "./helpers.ts";
import { Attr, DrawRT, Expr, InsertMethod, Rel } from "./datagen.ts";
import { parse_sql_with_sections } from "./parse_sql.js";

const SCALE_FACTOR = ENV(["SCALE_FACTOR", "BRANCHES"], 1, "TPC-B scale factor");
const POOL_SIZE = ENV("POOL_SIZE", 50, "Connection pool size");
const LOAD_WORKERS = ENV("LOAD_WORKERS", 0, "Load workers") as number;

const BRANCHES = SCALE_FACTOR;
const ACCOUNTS = 100_000 * SCALE_FACTOR;

export const options: Options = { setupTimeout: String(SCALE_FACTOR) + "m" };

const driverConfig = declareDriverSetup(0, {
  url: "postgres://postgres:postgres@localhost:5432",
  driverType: "postgres",
  defaultInsertMethod: "native",
  pool: { maxConns: POOL_SIZE, minConns: POOL_SIZE },
});

const SQL_FILE = ENV("SQL_FILE", ENV.auto, "SQL file path") ?? "./pg.sql";
const driver = DriverX.create().setup(driverConfig);
const sql = parse_sql_with_sections(open(SQL_FILE));

function accountsSpec() {
  return Rel.table("pgbench_accounts", {
    size: ACCOUNTS,
    seed: 0xACC07,
    method: InsertMethod.NATIVE,
    parallelism: LOAD_WORKERS || undefined,
    attrs: {
      aid: Attr.rowId(),
      bid: Expr.add(Expr.div(Attr.rowIndex(), Expr.lit(100_000)), Expr.lit(1)),
      abalance: Expr.lit(0),
    },
  });
}

export function setup() {
  Step("drop_schema", () => sql("drop_schema").forEach((q) => driver.exec(q, {})));
  Step("create_schema", () => sql("create_schema").forEach((q) => driver.exec(q, {})));
  Step("load_data", () => driver.insertSpec(accountsSpec()));
  Step.begin("workload");
}

const aidGen = DrawRT.intUniform(0xA1D, 1, ACCOUNTS);

export default function () {
  driver.beginTx((tx) => {
    tx.exec(sql("workload", "update_account")!, { aid: aidGen.next() });
  });
}

export function teardown() {
  Step.end("workload");
  Teardown();
}
```

Use `stroppy help datagen` for the terminal summary of the same current API.
