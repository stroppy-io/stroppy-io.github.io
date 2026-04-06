---
slug: measuring-stroppy-before-measuring-databases
title: "Measuring Stroppy Before Measuring Databases"
authors: [stroppy-authors]
tags: [development, drivers, noop, pg-noop, internals]
---

When you run a database benchmark, the tool itself is in the picture. If stroppy can only push 12 000 transactions per second, no database will ever look faster than that in your results — not because the database is slow, but because stroppy ran out of steam first. Knowing that ceiling matters.

We added two noop layers to make that ceiling easy to find: one in-process (a dummy driver) and one over the wire (a standalone pg-noop server). Together they bracket stroppy's throughput with and without the PostgreSQL protocol stack in the way.

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

## What These Numbers Tell You

Before comparing databases, you have two useful data points:

- **Noop ceiling**: the hard upper bound on stroppy's throughput on this hardware. Any result near this number means stroppy might be the bottleneck.
- **pg-noop ceiling**: the upper bound when the full protocol stack is involved. Any result near this number means the database is doing very little work and the cost is mostly in the client.

If your production PostgreSQL throughput sits well below the pg-noop ceiling, you're in good shape — the database is being measured, not the tool. If it's close, it's worth investigating whether stroppy is the limiting factor.

These baselines are also useful for cross-machine comparisons: the noop and pg-noop numbers characterize the test machine itself, which helps when moving between hardware or comparing results across environments.

---

Writing your own driver for a different database follows the same pattern as the noop driver — see [Extensibility](/docs/extensibility) for a walkthrough.

---

That 100 000 iter/s ceiling didn't start there. The [next post](/blog/stroppy-generator-performance) covers the pprof sessions on stroppy itself and the generator-pipeline changes behind the numbers you just saw.
