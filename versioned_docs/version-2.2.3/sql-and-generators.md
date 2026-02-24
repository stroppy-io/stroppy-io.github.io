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
--+ section cleanup
--= drop_branches
DROP TABLE IF EXISTS branches CASCADE;
--= drop_accounts
DROP TABLE IF EXISTS accounts CASCADE;

--+ section create_schema
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

--+ section workload
--= transfer
SELECT transfer(:src_aid, :dst_aid, :amount);
```

- `--+ section_name` &mdash; Starts a new section (group of queries)
- `--= query_name` &mdash; Names the next query
- Regular `--` comments are stripped

### Using in TypeScript

```typescript
import { parse_sql_with_groups } from "./parse_sql.js";

// open() is a k6 built-in that reads files at init time
const sections = parse_sql_with_groups(open(__ENV.SQL_FILE));

export function setup() {
  // Run all queries in the cleanup section
  sections["section cleanup"].forEach((query) => driver.runQuery(query, {}));

  // Run schema creation
  sections["section create_schema"].forEach((query) => driver.runQuery(query, {}));
}

export function workload() {
  // Run a specific named query with parameters
  driver.runQuery("SELECT transfer(:src, :dst, :amt)", {
    src: srcGen.next(),
    dst: dstGen.next(),
    amt: amtGen.next(),
  });
}
```

Each `ParsedQuery` object has:
- `name` &mdash; The query name from `--=`
- `sql` &mdash; The raw SQL string
- `type` &mdash; Detected type: `"CreateTable"`, `"Insert"`, `"Select"`, or `"Other"`
- `params` &mdash; Extracted parameter names

## Data Generators

Stroppy's generation system is built around two namespaces &mdash; `R` for random values and `S` for unique sequences &mdash; designed so that a column definition reads like a declaration of what data it should hold. Generators are seeded for reproducibility: the same seed and rules produce the same data every time.

### The `R` and `S` design

The idea is that you describe each column's data shape right where you use it. `R` (random) and `S` (sequence) both use the same overloaded signatures &mdash; pass one argument for a constant, two for a range, and an optional alphabet for strings:

```typescript
// R = random values, S = unique/sequential values
// Both share the same call signatures

R.int32(42)           // constant 42 every time
R.int32(1, 1000)      // random integer in [1, 1000]

S.int32(1, 100000)    // 1, 2, 3, ... 100000 (unique, sequential)

R.str("hello")        // constant string
R.str(10)             // random 10-char string, English alphabet
R.str(5, 20)          // random length between 5 and 20
R.str(5, 20, AB.enNum)// alphanumeric

S.str(10)             // unique 10-char strings
S.str(5, 20, AB.enNum)// unique, alphanumeric, variable length
```

The distinction matters: `S` generators are for primary keys and unique columns where every value must be different. `R` generators are for everything else &mdash; foreign keys, filler data, random balances.

### Full `R` reference

```typescript
// Strings
R.str("hello")                 // constant
R.str(10)                      // random, length 10, English
R.str(10, AB.en)               // explicit alphabet
R.str(5, 20)                   // variable length
R.str(5, 20, AB.enNum)         // variable length, alphanumeric

// Integers
R.int32(42)                    // constant
R.int32(1, 1000)               // random in range

// Floats and doubles
R.float(3.14)                  // constant
R.float(0.0, 100.0)            // random range
R.double(2.718)                // constant
R.double(0.0, 1.0)             // random range

// Booleans (ratio = probability of true)
R.bool(0.5)                    // 50% true
R.bool(1.0)                    // always true
R.bool(0.5, true)              // unique sequence: [false, true]

// Dates
R.datetimeConst(new Date("2024-01-01"))
```

### Full `S` reference

```typescript
S.int32(1, 100000)             // 1, 2, 3, ... (for primary keys)
S.str(10)                      // unique strings, length 10
S.str(5, 20, AB.enNum)         // unique, variable length, alphanumeric
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

### Standalone generators with `NewGen`

When you need a generator as a standalone object (e.g., to call `.next()` in a loop), use `NewGen()`. The seed controls reproducibility:

```typescript
import { NewGen, NewGroupGen, R } from "./helpers.ts";

const aidGen = NewGen(0, R.int32(1, 100000));
const deltaGen = NewGen(1, R.int32(-5000, 5000));

export function workload() {
  driver.runQuery("SELECT transfer(:aid, :delta)", {
    aid: aidGen.next(),
    delta: deltaGen.next(),
  });
}
```

Different seeds produce independent streams. Same seed + same rule = same sequence. This makes tests reproducible while allowing multiple independent generators in the same script.

### Group generators (Tuples)

Group generators produce tuples &mdash; all parameters advance together on each `.next()` call. This is useful when columns are logically related and you want their values to form coherent combinations:

```typescript
const groupGen = NewGroupGen(2, {
  params: R.params({
    id: S.int32(1, 100),
    name: S.str(10),
    active: R.bool(1, true),
  }),
});

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
  method: InsertMethod.PLAIN_QUERY,  // or COPY_FROM
  params: {
    column_name: R.int32(1, 100),    // generation rule per column
  },
});
```

This is the common case. Each key in `params` maps to a column, and its value is a generation rule (`R.*` or `S.*`) that produces data for that column.

### PLAIN_QUERY vs COPY_FROM

**PLAIN_QUERY** generates individual INSERT statements. Straightforward, works everywhere:

```typescript
driver.insert("users", 10000, {
  method: InsertMethod.PLAIN_QUERY,
  params: {
    id: S.int32(1, 10000),
    name: R.str(5, 20, AB.en),
    email: R.str(10, 30, AB.enNum),
    balance: R.float(0.0, 10000.0),
  },
});
```

**COPY_FROM** uses PostgreSQL's COPY protocol for maximum throughput &mdash; typically 5-10x faster than individual inserts. Use this for loading large data sets:

```typescript
driver.insert("accounts", 1000000, {
  method: InsertMethod.COPY_FROM,
  params: {
    aid: S.int32(1, 1000000),
    bid: R.int32(1, 10),
    abalance: R.int32(0),
    filler: R.str(84, AB.en),
  },
});
```

Notice how the column definitions read naturally: `aid` is a sequential integer from 1 to 1M (primary key), `bid` is a random integer from 1 to 10 (foreign key), `abalance` starts at 0 (constant), and `filler` is an 84-character random string.

### Grouped columns

When some columns form a logical group &mdash; like a composite foreign key, or columns that should produce correlated combinations &mdash; use `groups`:

```typescript
driver.insert("orders", 50000, {
  method: InsertMethod.COPY_FROM,
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
import { DriverConfig_DriverType, InsertMethod, Status } from "./stroppy.pb.js";
import { DriverX, NewGen, R, S, Step } from "./helpers.ts";
import { parse_sql_with_groups } from "./parse_sql.js";

const SCALE = +(__ENV.SCALE_FACTOR || 1);
const ACCOUNTS = 100000 * SCALE;

export const options: Options = {
  setupTimeout: "5h",
  scenarios: {
    tpcb: {
      executor: "constant-vus",
      exec: "tpcb",
      vus: 10,
      duration: __ENV.DURATION || "1h",
    },
  },
};

// Initialize driver with connection pooling
const driver = DriverX.fromConfig({
  driver: {
    url: __ENV.DRIVER_URL || "postgres://postgres:postgres@localhost:5432",
    driverType: DriverConfig_DriverType.DRIVER_TYPE_POSTGRES,
    connectionType: {
      is: { oneofKind: "sharedPool", sharedPool: { sharedConnections: 10 } },
    },
    dbSpecific: { fields: [] },
  },
});

// Parse SQL file into named sections
const sections = parse_sql_with_groups(open(__ENV.SQL_FILE));

export function setup() {
  // Run cleanup and schema creation queries from the SQL file
  Step("schema", () => {
    sections["section cleanup"].forEach((q) => driver.runQuery(q, {}));
    sections["section create_schema"].forEach((q) => driver.runQuery(q, {}));
  });

  // Bulk-load 100K accounts per scale factor using COPY protocol
  Step("load", () => {
    driver.insert("pgbench_accounts", ACCOUNTS, {
      method: InsertMethod.COPY_FROM,
      params: {
        aid: S.int32(1, ACCOUNTS),     // sequential primary key
        bid: R.int32(1, SCALE),         // random branch reference
        abalance: R.int32(0),           // starting balance
        filler: R.str(84),              // padding
      },
    });
  });
}

// Standalone generators for the hot loop
const aidGen = NewGen(5, R.int32(1, ACCOUNTS));
const deltaGen = NewGen(8, R.int32(-5000, 5000));

export function tpcb() {
  // Each VU calls this repeatedly for the duration of the test
  driver.runQuery("SELECT tpcb_transaction(:aid, :tid, :bid, :delta)", {
    aid: aidGen.next(),
    tid: NewGen(6, R.int32(1, 10 * SCALE)).next(),
    bid: NewGen(7, R.int32(1, SCALE)).next(),
    delta: deltaGen.next(),
  });
}

export function teardown() {
  Teardown();
}
```

The pattern here is typical: `setup()` uses structured SQL files and `insert()` with `S`/`R` rules to prepare the database, then the workload function uses standalone `NewGen` generators to feed parameterized queries in a tight loop.

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
  method: InsertMethod.COPY_FROM,
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
    c_since: R.datetimeConst(new Date()),
    c_credit: R.str("GC"),
    c_credit_lim: R.float(50000),
    c_discount: R.float(0, 0.5),                   // DECIMAL(4,4)
    c_balance: R.float(-10),
    c_ytd_payment: R.float(10),
    c_payment_cnt: R.int32(1),
    c_delivery_cnt: R.int32(0),
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

Every generation rule maps directly to the column's SQL type and constraints. `VARCHAR(16)` becomes `R.str(8, 16)`. `CHAR(9)` zip codes become `R.str(9, AB.num)`. The composite primary key `(c_w_id, c_d_id, c_id)` goes into a `groups` block where each component is a `S.int32` sequence, ensuring unique tuples via Cartesian product.

The full TPC-C workload loads 9 tables this way, then runs 5 concurrent transaction types (new_order, payments, order_status, delivery, stock_level) at a realistic mix ratio &mdash; all in about 270 lines of TypeScript.

## Distribution Types

Under the hood, generators support three statistical distributions:

| Distribution | Use case | Behavior |
|-------------|----------|----------|
| **Uniform** | Default. Equal probability across the range | Every value equally likely |
| **Normal** | Realistic clustering around a mean | Bell curve distribution |
| **Zipfian** | Hot-spot simulation (80/20 rule) | Few values accessed very frequently |

These are most useful when building custom workloads that need realistic access patterns &mdash; for example, a Zipfian distribution on account IDs simulates the real-world pattern where a small number of accounts see the majority of activity.
