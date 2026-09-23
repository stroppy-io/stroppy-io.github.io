---
slug: stroppy-vs-go-tpc
title: "Stroppy vs go-tpc: Where Does the Performance Gap Come From?"
authors: [stroppy-authors]
tags: [benchmark, tpc-c, orioledb, postgresql, stroppy, go-tpc]
---

Point two TPC-C load generators at the same database, same data, same concurrency, same duration — and they report noticeably different throughput. [Stroppy](https://github.com/stroppy-io/stroppy/releases/tag/v5.7.2) (ours) said ~3.6k transactions/sec; [go-tpc](https://github.com/pingcap/go-tpc/releases/tag/latest-a9ca4818625deef91ff80f6c395a575ccae22b7c) said ~6.1k. We wanted to know where that gap comes from before trusting either number.

This is the trail of guesses and tests we went through. We reached an answer we believe, and found two real bugs in Stroppy along the way.

{/* truncate */}

## Setup

One bare-metal box (56 cores, 128 GB RAM, SSD), [OrioleDB](https://github.com/orioledb/orioledb) ([pinned commit `abfbe83`](https://github.com/orioledb/orioledb/commit/abfbe83b38dbe0816cf74e8c5013c6588795f0d8)) on [Postgres 17](https://github.com/orioledb/postgres) (the [orioledb fork](https://github.com/orioledb/postgres/commit/d48d155c6b41d56e9e092b674f5bf17a49567694)), both load generators on the same machine as the database (no network variable). Default TPC-C mix, serializable isolation, no pacing. First run: 100 warehouses, 50 virtual users, 5 minutes.

| Tool | Transactions/sec | Queries per transaction |
|------|------------------|-------------------------|
| Stroppy `tpcc/tx` | ~3,600 | ~18 |
| go-tpc | ~6,100 | ~13 |

Same database, same data, same VUs. Two different numbers for "the same workload." We had theories.

## Theory 1: the connection pool

Stroppy uses a shared `pgx` pool; go-tpc gives each thread its own connection. Maybe Stroppy's VUs were blocking on pool acquisition. Bumped the pool from 50 to 53 (headroom over VUs). Result: 3,600 → 3,560. Noise. Not it.

## Theory 2: prepared statements

Stroppy defaults to pgx's `exec` mode (no prepared-statement cache); go-tpc prepares. Flipped Stroppy to `cache_statement`. Result: 3,615. Noise. Not it.

## Theory 3: foreign keys

Stroppy ships its schema with seven foreign keys; go-tpc creates none by default. Ran go-tpc *with* FKs to match. Result: go-tpc was marginally *faster* with FKs — within variance. On OrioleDB, FK enforcement is cheap. Not it.

Three reasonable-sounding theories, three misses. The lesson, for the third time: flip the switch and measure.

## The clue, then the proof

The clue was in the table the whole time: **queries per transaction**. A TPC-C transaction isn't one database operation — a New-Order reads customer, warehouse, district, updates the district counter, inserts the order, reads items, reads and updates stock per line, inserts order lines. The question is how many network round-trips each tool spends on that work.

Stroppy issues most of it as **separate statements** — `SELECT ... FROM customer`, then `FROM warehouse`, then `FROM district`, three round-trips where one would do. go-tpc **joins** the customer+warehouse read, **batches** stock reads with `IN (...)`, and uses **multi-row INSERT** for the order lines. Same logical work, ~13 round-trips instead of ~18.

That's a correlation, not a proof. To prove it wasn't the database, we needed to change only the round-trip count and nothing else. Stroppy has a second TPC-C mode, `tpcc/procs`, that runs each transaction as a single server-side stored-procedure `CALL` — one round-trip. Crucially, it's the *same tool, same schema, same data, same isolation* as `tpcc/tx`. If the database were the bottleneck, `procs` couldn't be faster — the DB does identical work either way.

| Tool | Transactions/sec | Round-trips/tx |
|------|------------------|----------------|
| Stroppy `tpcc/tx` | ~3,600 | 18 |
| Stroppy `tpcc/procs` | ~13,900 | 1 |

`procs` jumped to ~14k — nearly 4× faster, on the same database. And `pg_stat_database` confirmed the per-transaction DB work was identical in both cases (~5.8 row inserts, ~11 updates per transaction). The database was doing the same job; it just got fed faster when the client stopped chatting between every statement. Under `tx` and go-tpc, the DB was idle between round-trips.

That was the answer. The gap is **client composition** — how many round-trips each tool uses to express one transaction — not database performance.

## Does it hold up at scale?

Five-minute smoke tests find the shape; they don't earn trust. So we ran all three for an hour, at 1000 warehouses, 100 VUs.

| Tool | Transactions/sec | Transactions in 1h |
|------|------------------|--------------------|
| Stroppy `tpcc/tx` | 4,410 | 15.9M |
| Stroppy `tpcc/procs` | 15,791 | 56.9M |
| go-tpc | 6,399 (tpmC 172,756) | ~23M |

Same ordering, same rough ratios. The composition effect is stable at scale.

## Two bugs

The hour-long runs are where the bugs showed up.

**Memory.** The first hour-long `tpcc/tx` run was killed by the kernel at 58 minutes — out of memory, RSS at ~80 GB. Cause: every query records its latency into a k6 `Trend` metric, and `Trend` keeps *every observation* in memory for the whole run (no sub-sampling). At ~18 queries per transaction across millions of transactions, that's hundreds of millions of retained samples. `procs` barely leaks (one query per transaction); go-tpc doesn't have it. We added swap to finish the runs and [filed it](https://github.com/stroppy-io/stroppy/issues/112).

**Pacing.** Stroppy's `tpcc/procs` doesn't implement pacing at all — set `PACING=true` and `tx` slows down correctly while `procs` silently keeps running flat-out. [Filed](https://github.com/stroppy-io/stroppy/issues/113).

## Takeaways

- **"Transactions per second" is a property of (database, client), not the database alone.** Compare numbers only between clients whose round-trip behavior you understand.
- **Fewer round-trips wins, by multiples** — joins, `IN (...)` batches, multi-row inserts aren't micro-optimizations.
- **Server-side execution is the extreme case** — one `CALL` per transaction gave the biggest jump of anything we tried.
- **Flip switches, don't theorize.** Pool, prepared statements, and FKs all *sounded* like they should matter. None moved the number.

One machine, OrioleDB at a pinned commit, both tools at defaults — absolute numbers will differ elsewhere. We'd bet the *shape* (round-trips dominating) holds, because it follows directly from how client/server databases work. But that's a bet to measure, not assert. The bugs are [#112](https://github.com/stroppy-io/stroppy/issues/112) and [#113](https://github.com/stroppy-io/stroppy/issues/113); if you've seen similar gaps or have a cleaner fix for the metric retention, we'd like to hear about it.
