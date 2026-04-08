---
slug: tpc-across-four-dialects
title: "One TPC, Four Dialects: Notes from Porting TPC-B and TPC-C"
authors: [stroppy-authors]
tags: [workloads, tpc-b, tpc-c, postgres, mysql, picodata, ydb, compatibility]
---

We wanted a single TPC-B and a single TPC-C that run on all four databases stroppy currently knows how to talk to: PostgreSQL, MySQL, Picodata, and YDB. On paper that's "the same SQL against four SQL engines." In practice, it took four SQL files per workload, two TypeScript variants, and a pile of small compromises we didn't see coming.

This post is not about which database is fastest. Our test bed is local Docker images with default configuration on a laptop — the numbers at the end only prove the queries execute. It's about what getting them to execute looked like.

<!-- truncate -->

## The shape we wanted

One TPC-B file per database dialect (`pg.sql`, `mysql.sql`, `pico.sql`, `ydb.sql`), and the same for TPC-C. A single TypeScript driver script on top that picks the right SQL file based on the `--driver` preset. Section names inside the SQL files stay identical across dialects, so the script can just look up `workload_tx_new_order → get_district` and not care which engine is underneath.

That split shook out cleanly — we needed two TypeScript variants, not one:

- `procs.ts` — one call to a stored procedure per transaction. Faithful TPC-C, but only runs on PostgreSQL and MySQL.
- `tx.ts` — individual DML statements wrapped in `driver.beginTx({ isolation }, tx => { … })`. Runs on all four, and really does behave like the spec: `tx.queryRow`, `tx.queryValue`, and `tx.queryRows` all exist on the transaction handle, so the script can read `d_next_o_id` from district and then `INSERT` with that value in the following step. Every `o_id`, `c_id`, and per-delivery `ol_amount` in our implementation comes from a real SELECT inside the open transaction.

The one place we kept a client-side counter is `h_id` for the `history` table. The TPC-C spec doesn't give history a natural primary key, and PostgreSQL/MySQL don't require one — but Picodata and YDB do. Rather than branching the schema, we added a `BIGINT`/`Int64 h_id` column in all four dialects and generate it per-VU as `__VU * 10_000_000 + local_counter`. One uniform script, one set of parameters, four SQL files that all look the same at the call site.

## Picodata doesn't do transactions

The first thing we tripped on with Picodata is that `Begin()` unconditionally returns `ErrTransactionsUnsupported`. Every isolation level that routes through `Begin` — `read_committed`, `serializable`, even `conn` — errors out before the first `tx.exec` runs.

Stroppy's driver wrapper already had an escape hatch for this: isolation level `"none"` intercepts `beginTx` and routes each `tx.exec` directly to `RunQuery`, with no real transaction. Writes are immediately visible outside the "transaction", so it isn't giving us isolation — it's giving us a way to run the same script shape against a database that doesn't have transactions yet. For Picodata, `"none"` is the only mode that works at all.

So our per-dialect isolation map ended up as:

```ts
{ postgres: "read_committed",
  mysql:    "read_committed",
  picodata: "none",
  ydb:      "serializable" }
```

## Picodata's query planner doesn't like the obvious `stock_level`

Once the transactions were reading real values, TPC-C's `stock_level` — the "count distinct low-stock items in the last twenty orders of this district" query — started intermittently failing on Picodata. The error is memorable:

```
ERROR: sbroad: invalid space: Temporary SQL table TMP_… not found.
  Probably there are unused motions in the plan
```

Every other database (including YDB, which has its own distributed planner) runs the idiomatic CTE-joined-to-stock shape of the query without complaint. Picodata's sbroad creates a temporary result shard for the motion, and intermittently the temp table vanishes before the scan reads from it. It's a planner race, not something we can fix from SQL.

We tried three shapes: the CTE-as-derived-table form, `WHERE s_i_id IN (SELECT …)`, and `COUNT(DISTINCT)` with explicit `JOIN`. All three hit the same temp-table error on picodata — once you cross two sharded tables with a selective predicate, the motion pattern is the same and the race is still there.

What worked was splitting the scan into two round-trips: first collect the distinct `ol_i_id`s from the twenty-order window into a small TypeScript array, then count matching low-stock rows with an inline `IN (…)` list built from that array. Stroppy's `:name` parameter substitution leaves IN-list contents alone, so the integer literals pass through verbatim. Two queries instead of one, but `stock_level` is 4% of the TPC-C mix, and we'd rather pay an extra round-trip on 4% of traffic than branch the script by driver type. The same two-step is used on all four dialects; only picodata actually needs it, but the uniformity is worth the cost.

## YDB has its own dialect and its own rules

YDB's SQL (YQL) is the most divergent of the four. We knew this going in; we under-estimated how much of it mattered.

- **Types**: `Int32`, `Int64`, `Utf8`, `Timestamp`, `Decimal(p,s)`. No `VARCHAR`, no `TIMESTAMP`, no `CHAR(N)`.
- **Primary keys**: must be declared as a separate `PRIMARY KEY (...)` clause at the end of `CREATE TABLE`, not as a column modifier.
- **No `REFERENCES`**: foreign keys don't exist. All of them come out.
- **No `IF EXISTS` on `DROP TABLE`**: first-run drops always error. With stroppy's default error mode of `log`, we get nine lines of "table not found" on the first run, then it continues. Acceptable, but noisy.
- **`UPSERT INTO`** is the idiomatic insert, not `INSERT`.
- **`CurrentUtcTimestamp()`** instead of `CURRENT_TIMESTAMP`.
- **Parameters**: stroppy's YDB driver translates `:name` to `?` and leans on YDB's `WithAutoDeclare()` — so we don't need to write a `DECLARE` preamble, which was a pleasant surprise.

The interesting one was the `stock_level` query. The obvious `JOIN` form of the stock-count scan errored with:

```
JOIN: each equality predicate argument must depend on exactly one JOIN input
```

We had `AND s_w_id = :w_id` inside the `ON` clause. YDB's planner wants join predicates to reference exactly the two join inputs, not an external parameter. Moving the `:w_id` filter to the outer `WHERE` fixed it, and the run-query error rate dropped from 24 / 10 000 to 0.

## MySQL's `CREATE PROCEDURE` dance

MySQL is the closest to PostgreSQL for the bulk of the schema, but its stored procedures have their own pitfalls once you put them into a section-split SQL file.

Stroppy parses SQL files by looking for `--+ section` and `--= query` markers. Query bodies end at the next `--=` — which means inside a `CREATE PROCEDURE` we get to use semicolons freely, without a `DELIMITER` directive. Good: we don't need `DELIMITER $$` anywhere. Bad: we also can't have a trailing `;` after `END`, because the entire body is sent as one statement and MySQL rejects the dangling separator.

The parser has one more surprise: any line whose trimmed form starts with `--` is stripped before the query reaches the database. Fine for section headers, bad for comments inside procedure bodies. `-- rollback the row if dirty` vanishes silently. For multi-line procedure bodies, we either use `/* ... */` or just leave them uncommented.

Two smaller mysql-specific things bit us once each:

- **`CREATE ROUTINE` privilege** — the default `myuser` we use in the dev stack doesn't have it. We either grant it once or connect as `root` for the setup phase.
- **No `CONTINUE` in `WHILE`** — the delivery procedure's "skip this district if there's nothing to deliver" path became an `IF v_no_o_id IS NOT NULL THEN …` guard instead.

The other MySQL surprise showed up only once we started reading CHAR columns from inside a transaction. `go-sql-driver/mysql` scans CHAR/VARCHAR into `[]byte` when the destination is `*interface{}`; `lib/pq` gives back a native `string`. Our row values go through `database/sql.Scan` into `*any`, and until this port we never noticed the difference because nothing downstream cared. Reading `s_dist_NN` from stock and passing it straight back into `order_line.ol_dist_info` exposed it immediately: the mysql branch started failing with `Error 1406: Data too long for column 'ol_dist_info'`, because the JavaScript side was seeing a `Uint8Array`-like value and stringifying it as `"120,196,…"` — two or three characters per byte, comma-separated. The fix was a three-line post-scan in `sqldriver/rows.go` that converts any `[]byte` result to `string`, so the JS side sees a plain `"8nBAHsPMU1wCGLyeNDmRiCeU"` regardless of the underlying driver. It's one of those fixes you leave behind thinking "how did this ever work?" — the answer is "nothing read CHAR columns via `queryRow` before."

## Picodata runs out of memory before it runs the workload

This one didn't look like a compatibility problem and took the longest to diagnose. The Picodata container accepted the schema, accepted the bulk inserts, and then the workload produced a 95% transaction error rate. The error messages pointed at `MemoryIssue: Failed to allocate N bytes in slab allocator for memtx_tuple`.

Picodata's default `memtx_memory` is 64 MB. The TPC-C seed data (100 000 items, 100 000 stock rows with ten 24-byte `s_dist_*` columns each, 30 000 customers with a 300–500-character `c_data`) doesn't fit. It fits well enough for the load phase to report a partial success — one of five bulk-insert batches didn't complete — and then the workload runs against a half-loaded schema and OOMs on every write.

The fix is a one-line environment variable:

```yaml
environment:
  PICODATA_MEMTX_MEMORY: "2G"
```

Nothing in our test script would have caught this. The failing metric was `insert_error_rate: 20%` on the load phase — 1 of 5 batches — and we kept reading it as "the workload errored", not "the data isn't all there."

## The small thing that saved us time

History tables in TPC-B (`pgbench_history`) and TPC-C (`history`) are semantically append-only logs. In a faithful implementation they don't need a primary key at all — PostgreSQL and MySQL are happy to leave them keyless. Picodata and YDB both require a primary key on every table.

We could have branched the schema by dialect. Instead, we added `h_id BIGINT NOT NULL PRIMARY KEY` (or `Int64`, in YQL) to the history table in **all four** dialects, and had the TypeScript scripts generate `h_id` client-side as a per-VU counter starting at `__VU * 10_000_000`. One script, one set of parameters, four SQL files that all look the same at the call site. No runtime branching on driver type inside the workload loop.

This turned out to be the single nicest decision in the whole porting exercise. Every time we would have needed a `if driverType === "picodata"` inside TypeScript, the uniform column saved us.

## Embedded files: the thing we kept forgetting

One workflow gotcha worth mentioning, because it ate half an hour before we wrote it on the wall: `workloads/embed.go` declares `//go:embed *` over the entire `workloads/` directory. The script runner stages files from the embedded FS, not from disk. Editing a `.sql` or `.ts` file and re-running stroppy has no effect — the binary ships an in-memory snapshot.

The fix is boring: `make build && ./build/stroppy run ...` as a single chained command for every iteration. We wrote a memo to ourselves and stopped losing time to it.

## The numbers

Small caveats first, because otherwise these numbers invite a wrong reading:

- All four databases run as **local Docker images with default configuration**, on a laptop (`Intel Core Ultra 7 155H, 22 cores, 32 GB RAM`).
- **10-second duration, 1 VU**, `VUS_SCALE=0.01`. This is a smoke test, not a benchmark.
- The point of the table is to show that **every (variant × database) combination runs cleanly**. Iteration counts are not comparable across databases — the container resource limits, storage engines, default fsync behaviour, and network stack all differ.

With that said:

| Workload | Variant  | Database | Iterations | Errors |
|----------|----------|----------|-----------:|-------:|
| TPC-B    | procs.ts | postgres |     10 834 |      0 |
| TPC-B    | procs.ts | mysql    |      5 428 |      0 |
| TPC-B    | tx.ts    | postgres |      6 332 |      0 |
| TPC-B    | tx.ts    | mysql    |      3 234 |      0 |
| TPC-B    | tx.ts    | picodata |     11 935 |      0 |
| TPC-B    | tx.ts    | ydb      |      1 713 |    † |
| TPC-C    | procs.ts | postgres |      8 763 |      0 |
| TPC-C    | procs.ts | mysql    |        532 |      0 |
| TPC-C    | tx.ts    | postgres |      2 177 |      0 |
| TPC-C    | tx.ts    | mysql    |      1 210 |      0 |
| TPC-C    | tx.ts    | picodata |      2 061 |      0 |
| TPC-C    | tx.ts    | ydb      |        308 |    † |

† On a fresh YDB database the initial `DROP TABLE` statements fail because YDB doesn't accept `IF EXISTS` — we see nine log lines of "table not found" on the first run. After the first run, drops succeed and the error count is zero.

## What we're taking away from this

We started the porting effort assuming "TPC-B and TPC-C are well-specified, so porting them across four SQL dialects is mostly typing." What we ran into is that a test isn't a spec. A test is a spec **plus** a client **plus** a wire protocol **plus** a parser **plus** a set of defaults, and every database has a different combination of all of those.

The interesting finding, for us, was that portable workload tests across real SQL dialects aren't a matter of finding "the common subset" of SQL. They're a matter of deciding, per problem, where to absorb the difference: in the schema, in the script, in the driver, or in the test runner itself. We ended up using all four, and each choice had a cost.

Stroppy's role in this is modest but useful: section-based SQL files let us keep the differences visible and side by side, and the per-driver wire adapters take care of the lowest-level quirks (like YDB's `AutoDeclare`). The rest is us learning the dialect — which, it turns out, is most of the work.

---

The four SQL files and two TypeScript variants per workload live under `workloads/tpcb/` and `workloads/tpcc/` in the stroppy repository. Running them against a local stack is a matter of `./build/stroppy run tpcc/tx.ts -d <pg|mysql|pico|ydb>`.
