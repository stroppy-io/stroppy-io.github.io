---
slug: measuring-stroppy-before-measuring-databases
title: "Measuring Stroppy Before Measuring Databases"
authors: [stroppy-authors]
tags: [development, drivers, noop, pg-noop, internals]
---

Stroppy's own throughput caps benchmark results — if stroppy tops out at 12 000 iterations per second, no database under test will appear faster than that, regardless of its actual performance.

Stroppy already has two points where it communicates with the outside world: the driver layer, which handles query construction and dispatch, and the wire protocol layer beneath it. We added a noop sink to each — an in-process driver that discards all operations and a standalone pg-noop server that speaks the full PostgreSQL wire protocol but returns empty results. Together they give us throughput ceilings with and without the protocol stack involved.

<!-- truncate -->

## The Built-in Noop Driver

The first layer is a driver inside stroppy that accepts all operations and discards them. The data generator runs in full, queries are built and parameterized correctly, but nothing reaches a socket. It landed in [PR #61](https://github.com/stroppy-io/stroppy/pull/61).

It serves two purposes. During development, it gives us a full E2E path without requiring a database — useful for testing workload scripts and driver logic before spinning anything up. And during benchmarking, it measures stroppy's absolute throughput ceiling: the full stroppy cost with no network and no database in the picture.

Running the TPC-C `pick` workload against the noop driver on our test machine:

```bash
stroppy run tpcc/pick -d noop -- --vus 8 --duration 30s
```

gives about **100 000 iterations/s** at 8 VUs. That's the maximum stroppy can produce on this hardware. If we saw a real database approach this number, we'd know the database isn't the bottleneck — stroppy is.

## pg-noop: Adding the Protocol Layer

The second layer is a standalone server: [pg-noop](https://github.com/stroppy-io/pg-noop). It listens on a regular PostgreSQL port and speaks the full wire protocol — simple query, extended query, COPY — but treats every statement as a no-op and returns mechanically valid empty responses.

```bash
# Install and run
curl -LsSf https://github.com/stroppy-io/pg-noop/releases/latest/download/pg-noop-installer.sh | sh
pgnoop

# Run stroppy against it as a regular postgres target
stroppy run tpcc/pick -- --vus 8 --duration 30s
```

No configuration needed on stroppy's side — it connects to localhost:5432 and sees a normal PostgreSQL server.

The implementation is small. It's built on the Rust [pgwire](https://github.com/sunng87/pgwire) library: a `NoopHandler` that implements the four required traits (`StartupHandler`, `SimpleQueryHandler`, `ExtendedQueryHandler`, `CopyHandler`), a Tokio acceptor loop, and jemalloc for the musl build. That's the whole thing.

The same workload against pg-noop yields about **41 000 iterations/s** at VUS=8 — versus 100 000 against the in-process noop. The gap is the PostgreSQL wire protocol overhead on localhost: connection management, query serialization, network round-trips, response parsing. At VUS=1 the uncontended per-transaction cost difference is about 51 µs — the protocol cost with no database work.

| Driver | VUS=1 | VUS=8 |
|--------|------:|------:|
| noop (in-process) | 29 421/s | 100 419/s |
| pg-noop (TCP localhost) | 11 814/s | 41 352/s |

## What These Numbers Tell Us

Before comparing databases, we have two useful data points:

- **Noop ceiling**: the hard upper bound on stroppy's throughput on this hardware. Any result near this number means stroppy might be the bottleneck.
- **pg-noop ceiling**: the upper bound when the full protocol stack is involved. Any result near this number means the database is doing very little work and the cost is mostly in the client.

If production PostgreSQL throughput sits well below the pg-noop ceiling, we're in good shape — the database is being measured, not the tool. If it's close, it's worth investigating whether stroppy is the limiting factor.

These baselines are also useful for cross-machine comparisons: the noop and pg-noop numbers characterize the test machine itself, which helps when moving between hardware or comparing results across environments.

---

Writing a driver for a different database follows the same pattern as the noop driver — see [Extensibility](/docs/extensibility) for a walkthrough.

---

The numbers in the tables above are after the generator-pipeline optimizations — the [next post](/blog/stroppy-generator-performance) covers the profiling sessions and changes that produced them.
