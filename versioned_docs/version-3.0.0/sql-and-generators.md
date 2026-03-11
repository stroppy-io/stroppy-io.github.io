---
sidebar_position: 2
title: SQL & Generators
description: Deep dive into SQL syntax, parameterized queries, structured SQL files, and the data generation system
---

# SQL & Generators

Stroppy provides two core primitives for database testing: **parameterized SQL execution** and **data generation with statistical distributions**. This page covers both in depth.

## Parameterized Queries

### The `:param` syntax

Stroppy uses `:paramName` syntax for query parameters. The driver converts these to PostgreSQL-style `$1, $2, ...` placeholders at execution time.

```typescript
driver.runQuery("SELECT :value + :second", {
  value: 100,
  second: 50,
});
// Executes: SELECT $1 + $2   with args [100, 50]
```

Parameters are deduplicated &mdash; the same name used multiple times maps to the same positional argument:

```typescript
driver.runQuery("SELECT :x + :x", { x: 42 });
// Executes: SELECT $1 + $1   with args [42]
```

### Type casting

PostgreSQL `::` casts work naturally since the parser distinguishes `:param` from `::`:

```typescript
driver.runQuery("SELECT :a::int + :b::int", { a: 34, b: 35 });
// Executes: SELECT $1::int + $2::int   with args [34, 35]
```

### Argument validation

The driver validates that:
- Every `:param` in the SQL has a corresponding key in the args object
- No extra keys are provided that don't appear in the SQL

Both cases produce clear error messages.

## Structured SQL Files

For larger workloads, Stroppy supports structured SQL files with named sections and queries. This keeps your SQL organized and your TypeScript clean.

### Syntax

```sql
--+ cleanup
--= drop_branches
DROP TABLE IF EXISTS branches CASCADE;
--= drop_accounts
DROP TABLE IF EXISTS accounts CASCADE;

--+ create_schema
--= create_branches
CREATE TABLE branches (
    bid INTEGER NOT NULL PRIMARY KEY,
    bbalance INTEGER,
    filler CHAR(88)
);

--= create_accounts
CREATE TABLE accounts (
    aid INTEGER NOT NULL PRIMARY KEY,
    bid INTEGER,
    abalance INTEGER,
    filler CHAR(84)
);

--+ workload
--= transfer
SELECT transfer(:src_aid, :dst_aid, :amount);
```

- `--+ name` &mdash; Starts a new section (group of queries)
- `--= query_name` &mdash; Names the next query (name is optional)
- Regular `--` comments are stripped

### Using in TypeScript

`parse_sql_with_sections` returns a callable function with overloaded signatures:

```typescript
import { parse_sql_with_sections } from "./parse_sql.js";

// open() is a k6 built-in that reads files at init time
const sql = parse_sql_with_sections(open(__ENV.SQL_FILE));

sql()                              // → Record<string, ParsedQuery[]> (all sections)
sql("cleanup")                     // → ParsedQuery[] (all queries in section)
sql("workload", "transfer")        // → ParsedQuery | undefined (specific query)
```

Usage in a test script:

```typescript
export function setup() {
  // Run all queries in the cleanup section
  sql("cleanup").forEach((query) => driver.exec(query, {}));

  // Run schema creation
  sql("create_schema").forEach((query) => driver.exec(query, {}));
}

export default function () {
  // Run a specific named query with parameters
  driver.exec(sql("workload", "transfer")!, {
    src: srcGen.next(),
    dst: dstGen.next(),
    amt: amtGen.next(),
  });
}
```

For SQL files without sections, use `parse_sql` instead:

```typescript
import { parse_sql } from "./parse_sql.js";

const queries = parse_sql(open(__ENV.SQL_FILE));

queries()                // → ParsedQuery[] (all queries)
queries("my_query")      // → ParsedQuery | undefined
```

Each `ParsedQuery` object has:
- `name` &mdash; The query name from `--=`
- `sql` &mdash; The raw SQL string
- `type` &mdash; Detected type: `"CreateTable"`, `"Insert"`, `"Select"`, or `"Other"`
- `params` &mdash; Extracted parameter names

## Data Generators

Stroppy's generation system is built around three namespaces &mdash; `R` for random values, `S` for unique sequences, and `C` for constants &mdash; designed so that a column definition reads like a declaration of what data it should hold.

### The `R`, `S`, and `C` design

The idea is that you describe each column's data shape right where you use it:

```typescript
// C = constant values
C.int32(42)           // constant 42 every time
C.str("hello")        // constant string
C.float(0)            // constant 0.0
C.datetime(new Date())// constant timestamp

// R = random values (ranges)
R.int32(1, 1000)      // random integer in [1, 1000]
R.str(10)             // random 10-char string, English alphabet
R.str(5, 20)          // random length between 5 and 20
R.str(5, 20, AB.enNum)// alphanumeric
R.float(0, 100)       // random float

// S = unique/sequential values
S.int32(1, 100000)    // 1, 2, 3, ... 100000 (unique, sequential)
S.str(10)             // unique 10-char strings
S.str(5, 20, AB.enNum)// unique, alphanumeric, variable length
```

`C` generators produce the same value every call. `S` generators are for primary keys and unique columns where every value must be different. `R` generators are for everything else &mdash; foreign keys, filler data, random balances.

### Full `C` reference (constants)

```typescript
C.str("hello")                 // fixed string
C.int32(42)                    // fixed 32-bit integer
C.int64(9999999999)            // fixed 64-bit integer
C.float(3.14)                  // fixed 32-bit float
C.double(2.718)                // fixed 64-bit float
C.decimal("99.99")             // fixed arbitrary-precision decimal
C.bool(true)                   // fixed boolean
C.datetime(new Date())         // fixed timestamp
C.uuid("550e8400-...")         // fixed UUID
```

### Full `R` reference (random)

```typescript
// Strings
R.str(10)                      // random, length 10, English
R.str(10, AB.en)               // explicit alphabet
R.str(5, 20)                   // variable length
R.str(5, 20, AB.enNum)         // variable length, alphanumeric

// Integers
R.int32(1, 1000)               // random in range
R.int64(1, 1000000000)         // 64-bit range
R.uint32(0, 100)               // unsigned 32-bit range
R.uint64(0, 1000000000)        // unsigned 64-bit range

// Floats and doubles
R.float(0.0, 100.0)            // random 32-bit float range
R.double(0.0, 1.0)             // random 64-bit float range
R.decimal(0, 999.99)           // random decimal range (number bounds)
R.decimal("0.01", "999.99")    // random decimal range (string bounds)

// Booleans (ratio = probability of true)
R.bool(0.5)                    // 50% true
R.bool(1.0)                    // always true
R.bool(0.5, true)              // unique sequence: [false, true]

// Dates
R.datetime(new Date("2020-01-01"), new Date("2025-01-01"))

// UUIDs
R.uuid()                       // random UUID v4
R.uuidSeeded()                 // reproducible UUID v4
```

### Full `S` reference (sequential/unique)

```typescript
S.int32(1, 100000)             // 1, 2, 3, ... (for primary keys)
S.int64(1, 1000000000)         // 64-bit sequential
S.uint32(0, 100)               // unsigned 32-bit sequential
S.uint64(0, 1000000000)        // unsigned 64-bit sequential
S.str(10)                      // unique strings, length 10
S.str(5, 20, AB.enNum)         // unique, variable length, alphanumeric
S.uuid("ffffffff-...")         // sequential UUIDs up to max
S.uuid("00000001-...", "fff...") // sequential UUIDs in range
```

### Alphabets (`AB`)

Built-in character sets for string generation:

| Alphabet | Characters |
|----------|-----------|
| `AB.en` | `a-z`, `A-Z` |
| `AB.enNum` | `a-z`, `A-Z`, `0-9` |
| `AB.num` | `0-9` |
| `AB.enUpper` | `A-Z` |
| `AB.enSpc` | `a-z`, `A-Z`, space |
| `AB.enNumSpc` | `a-z`, `A-Z`, `0-9`, space |

### Standalone generators with `.gen()`

Every rule has a `.gen()` method that creates a standalone generator object with a `.next()` method:

```typescript
import { R, S, C } from "./helpers.ts";

const aidGen = R.int32(1, 100000).gen();
const deltaGen = R.int32(-5000, 5000).gen();

export default function () {
  driver.exec("SELECT transfer(:aid, :delta)", {
    aid: aidGen.next(),
    delta: deltaGen.next(),
  });
}
```

An optional seed argument controls reproducibility: `.gen(42)` produces the same sequence every time, `.gen(0)` (or no argument) uses the module-wide seed set via `setSeed()`.

### Group generators (Tuples)

Group generators produce tuples &mdash; all parameters advance together on each `.next()` call. Use `R.group()` to build one:

```typescript
const groupGen = R.group({
  id: S.int32(1, 100),
  name: S.str(10),
  active: R.bool(1, true),
}).gen();

// Each call returns an array of values in parameter order
for (let i = 0; i < 100; i++) {
  const [id, name, active] = groupGen.next();
  console.log(id, name, active);
}
```

## Bulk Insertion

`DriverX.insert()` combines data generation with bulk loading in a single call. You declare the table, the row count, and a generation rule for each column &mdash; Stroppy handles the rest.

The API is overloaded for convenience: you can either pass the table name, count, and column rules as separate arguments, or pass a full descriptor object for advanced cases.

### The ergonomic form

```typescript
driver.insert("table_name", rowCount, {
  method: "plain_query",  // or "copy_from"
  params: {
    column_name: R.int32(1, 100),    // generation rule per column
  },
});
```

This is the common case. Each key in `params` maps to a column, and its value is a generation rule (`R.*`, `S.*`, or `C.*`) that produces data for that column.

### `plain_query` vs `copy_from`

**`plain_query`** generates individual INSERT statements. Straightforward, works everywhere:

```typescript
driver.insert("users", 10000, {
  method: "plain_query",
  params: {
    id: S.int32(1, 10000),
    name: R.str(5, 20, AB.en),
    email: R.str(10, 30, AB.enNum),
    balance: R.float(0.0, 10000.0),
  },
});
```

**`copy_from`** uses PostgreSQL's COPY protocol for maximum throughput &mdash; typically 5-10x faster than individual inserts. Use this for loading large data sets:

```typescript
driver.insert("accounts", 1000000, {
  method: "copy_from",
  params: {
    aid: S.int32(1, 1000000),
    bid: R.int32(1, 10),
    abalance: C.int32(0),
    filler: R.str(84, AB.en),
  },
});
```

Notice how the column definitions read naturally: `aid` is a sequential integer from 1 to 1M (primary key), `bid` is a random integer from 1 to 10 (foreign key), `abalance` starts at 0 (constant via `C`), and `filler` is an 84-character random string.

### Grouped columns

When some columns form a logical group &mdash; like a composite foreign key, or columns that should produce correlated combinations &mdash; use `groups`:

```typescript
driver.insert("orders", 50000, {
  method: "copy_from",
  params: {
    oid: S.int32(1, 50000),
    amount: R.float(1.0, 999.99),
  },
  groups: {
    customer: {
      cid: R.int32(1, 1000),
      region: R.int32(1, 5),
    },
  },
});
```

Columns within a group are generated together as tuples, ensuring coherent combinations. Columns in `params` are generated independently.

## Putting It All Together: TPC-B Example

Here's a condensed version of the built-in TPC-B workload showing SQL files, generators, and bulk insertion working together:

```typescript
import { Options } from "k6/options";
import { Teardown } from "k6/x/stroppy";
import { DriverConfig_DriverType } from "./stroppy.pb.js";
import { DriverX, AB, C, R, Step, S, ENV } from "./helpers.ts";
import { parse_sql_with_sections } from "./parse_sql.js";

const SCALE = ENV("SCALE_FACTOR", 1, "TPC-B scale factor");
const BRANCHES = SCALE;
const TELLERS = 10 * SCALE;
const ACCOUNTS = 100000 * SCALE;

export const options: Options = {
  setupTimeout: String(SCALE) + "m",
};

// Initialize driver
const driver = DriverX.create().setup({
  url: ENV("DRIVER_URL", "postgres://postgres:postgres@localhost:5432", "Database connection URL"),
  driverType: DriverConfig_DriverType.DRIVER_TYPE_POSTGRES,
  driverSpecific: {
    oneofKind: "postgres",
    postgres: {},
  },
});

// Parse SQL file into named sections
const sql = parse_sql_with_sections(
  open(ENV("SQL_FILE", "./tpcb.sql", "Path to SQL file")),
);

export function setup() {
  // Run cleanup and schema creation queries from the SQL file
  Step("cleanup", () => {
    sql("cleanup").forEach((q) => driver.exec(q, {}));
  });

  Step("create_schema", () => {
    sql("create_schema").forEach((q) => driver.exec(q, {}));
  });

  // Bulk-load data using COPY protocol
  Step("load_data", () => {
    driver.insert("pgbench_accounts", ACCOUNTS, {
      method: "copy_from",
      params: {
        aid: S.int32(1, ACCOUNTS),     // sequential primary key
        bid: R.int32(1, BRANCHES),      // random branch reference
        abalance: C.int32(0),           // starting balance (constant)
        filler: R.str(84, AB.en),       // padding
      },
    });

    sql("analyze").forEach((q) => driver.exec(q, {}));
  });

  Step.begin("workload");
}

// Standalone generators for the hot loop
const aidGen = R.int32(1, ACCOUNTS).gen();
const tidGen = R.int32(1, TELLERS).gen();
const bidGen = R.int32(1, BRANCHES).gen();
const deltaGen = R.int32(-5000, 5000).gen();

// Default export = the workload k6 runs per VU
export default function () {
  driver.exec(sql("workload", "tpcb_transaction")!, {
    p_aid: aidGen.next(),
    p_tid: tidGen.next(),
    p_bid: bidGen.next(),
    p_delta: deltaGen.next(),
  });
}

export function teardown() {
  Step.end("workload");
  Teardown();
}
```

The pattern here is typical: `setup()` uses structured SQL files and `insert()` with `S`/`R`/`C` rules to prepare the database, then the default export uses standalone `.gen()` generators to feed parameterized queries in a tight loop.

## DDL and Insert in Harmony: TPC-C

The TPC-C workload is where the generator syntax really shines. Look at how the SQL schema and the TypeScript inserts mirror each other.

The SQL defines the `customer` table:

```sql
CREATE TABLE customer (
  c_id INTEGER,
  c_d_id INTEGER,
  c_w_id INTEGER REFERENCES warehouse(w_id),
  c_first VARCHAR(16),
  c_middle CHAR(2),
  c_last VARCHAR(16),
  c_street_1 VARCHAR(20),
  c_street_2 VARCHAR(20),
  c_city VARCHAR(20),
  c_state CHAR(2),
  c_zip CHAR(9),
  c_phone CHAR(16),
  c_since TIMESTAMP,
  c_credit CHAR(2),
  c_credit_lim DECIMAL(12,2),
  c_discount DECIMAL(4,4),
  c_balance DECIMAL(12,2),
  c_ytd_payment DECIMAL(12,2),
  c_payment_cnt INTEGER,
  c_delivery_cnt INTEGER,
  c_data VARCHAR(500),
  PRIMARY KEY (c_w_id, c_d_id, c_id)
);
```

And the insert reads like a declaration of what data each column should hold:

```typescript
driver.insert("customer", TOTAL_CUSTOMERS, {
  method: "copy_from",
  params: {
    c_first: R.str(8, 16),                        // VARCHAR(16)
    c_middle: R.str(2, AB.enUpper),                // CHAR(2)
    c_last: S.str(6, 16),                          // unique last names
    c_street_1: R.str(10, 20, AB.enNumSpc),        // VARCHAR(20)
    c_street_2: R.str(10, 20, AB.enNumSpc),
    c_city: R.str(10, 20, AB.enSpc),
    c_state: R.str(2, AB.enUpper),                 // CHAR(2)
    c_zip: R.str(9, AB.num),                       // CHAR(9), digits only
    c_phone: R.str(16, AB.num),                    // CHAR(16), digits only
    c_since: C.datetime(new Date()),               // constant timestamp
    c_credit: C.str("GC"),                         // constant string
    c_credit_lim: C.float(50000),                  // constant
    c_discount: R.float(0, 0.5),                   // DECIMAL(4,4)
    c_balance: C.float(-10),                       // constant
    c_ytd_payment: C.float(10),                    // constant
    c_payment_cnt: C.int32(1),                     // constant
    c_delivery_cnt: C.int32(0),                    // constant
    c_data: R.str(300, 500, AB.enNumSpc),          // VARCHAR(500)
  },
  groups: {
    customer_pk: {                                  // PRIMARY KEY (c_w_id, c_d_id, c_id)
      c_d_id: S.int32(1, DISTRICTS_PER_WAREHOUSE),
      c_w_id: S.int32(1, WAREHOUSES),
      c_id: S.int32(1, CUSTOMERS_PER_DISTRICT),
    },
  },
});
```

Every generation rule maps directly to the column's SQL type and constraints. `VARCHAR(16)` becomes `R.str(8, 16)`. `CHAR(9)` zip codes become `R.str(9, AB.num)`. Fixed values like `c_credit_lim` use `C.float(50000)`. The composite primary key `(c_w_id, c_d_id, c_id)` goes into a `groups` block where each component is a `S.int32` sequence, ensuring unique tuples via Cartesian product.

The full TPC-C workload loads 9 tables this way, then runs 5 concurrent transaction types (new_order, payments, order_status, delivery, stock_level) at a realistic mix ratio &mdash; all in about 270 lines of TypeScript.

## Distribution Types

Under the hood, generators support three statistical distributions:

| Distribution | Use case | Behavior |
|-------------|----------|----------|
| **Uniform** | Default. Equal probability across the range | Every value equally likely |
| **Normal** | Realistic clustering around a mean | Bell curve distribution |
| **Zipfian** | Hot-spot simulation (80/20 rule) | Few values accessed very frequently |

These are most useful when building custom workloads that need realistic access patterns &mdash; for example, a Zipfian distribution on account IDs simulates the real-world pattern where a small number of accounts see the majority of activity.
