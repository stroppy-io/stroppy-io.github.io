---
sidebar_position: 3
title: FoundationDB Report
description: Performance and correctness testing of FoundationDB with the original Stroppy framework
---

# FoundationDB Benchmark Report

:::caution Legacy Documentation
This report was produced using the **original Stroppy framework**. The methodology, test infrastructure, and tooling differ from the current CLI version.
:::

## The Problem

Unlike most system software, the database market is as vibrant today as it was ten or twenty years ago. The hardware revolution &mdash; switching from rotating to solid state drives, then from SSD to NVM &mdash; all in a single decade, advance of hyper-converged architecture and multi-cloud create a brave new world for database vendors and consumers.

Parallel to hardware changes, the open source revolution presents users with [hundreds of new database offerings](https://dbdb.io/) and highlights growth of the on-premise database market. A massive shift towards polyglot persistence, cloud and multi-cloud demonstrates even bigger growth both in data volume and variety of processing needs.

Financial institutions have been pioneer adopters of database software, yet surprising laggards with NoSQL and the cloud. Concerns of security, manageability and reliability kept banks conservative.

After a decade of growth, the NoSQL market has matured. MongoDB added transaction support in 2020. CockroachDB was first released in 2017. FoundationDB, founded in 2013, was acquired by Apple and re-released as open source in 2018.

By 2021, with multiple free, horizontally scalable, transactional NoSQL databases available, the market was seeing a tectonic shift: NoSQL no longer means no transactions. Adoption of this advance required industry benchmarks &mdash; and no widely adopted instrument existed to test how well NoSQL databases fare in the historically SQL domain of financial transactions.

## The Test

A credible test needed to prove:
- ACID properties are preserved in a distributed NoSQL environment, including during node and network failures
- Applications can scale with cluster size
- Performance is comparable to vertically scaled DBMS on similar hardware

The test runs a typical financial application: a series of bank money transfers between accounts. The key insight is that **no amount of transfers can change the total balance of all accounts**.

Three steps:
1. **Data generation** &mdash; Load bank accounts with initial balances. Store total balance as canonical result.
2. **Money transfers** &mdash; Run parallel transfers between accounts. Step is paralleled with nemesis (network partitions, hardware failures, topology changes).
3. **Balance verification** &mdash; Download end balances and verify total hasn't changed.

## The Subject and the Environment

[FoundationDB](https://www.foundationdb.org/) is a transactional NoSQL database maintained by Apple under Apache 2.0 license. Its key design property is service-based, non-homogenous architecture &mdash; storage, transaction log, proxy, and coordinator roles can be placed at different nodes.

**Testing goals:**
- Verify ACID properties
- Compare performance against PostgreSQL
- Test horizontal scalability

**Hardware:** Oracle Cloud E3.Flex instances. Network bandwidth 1 Gb/s. Disk bandwidth 1 Gb/s per core.

**Failure injection:** [Chaos-mesh](https://chaos-mesh.org/) for kubernetes.

## Results

### Table 1: Consolidated Results

| # | Vendor | Nodes | VCPU/Node | RAM/Node (GB) | HDD/Node (GB) | Clients | Accounts (M) | Transfers (M) | TPS |
|---|--------|-------|-----------|---------------|----------------|---------|---------------|----------------|-----|
| 1 | FDB | 3 | 1 | 8 | 100 | 16 | 10 | 100 | **2,263** |
| 2 | FDB+chaos | 3 | 2 | 8 | 100 | 16 | 10 | 100 | **2,189** |
| 3 | FDB | 5 | 1 | 8 | 100 | 512 | 10 | 100 | **7,631** |
| 4 | FDB+chaos | 5 | 1 | 8 | 100 | 512 | 10 | 100 | **7,528** |
| 5 | FDB | 5 | 1 | 16 | 100 | 512 | 100 | 100 | **5,782** |
| 6 | FDB | 20 | 1 | 16 | 100 | 512 | 100 | 100 | **10,854** |
| 7 | FDB | 5 | 1 | 16 | 100 | 512 | 1,000 | 10 | **3,369** |
| 8 | PG | 2 | 3 | 30 | 100 | 128 | 10 | 100 | **2,059** |
| 9 | PG | 2 | 10 | 160 | 100 | 256 | 100 | 100 | **5,915** |

**Key observations:**
- Additional VCPU doesn't increase throughput for FDB (Run #2 vs #1)
- Optimal concurrency: 512 clients for FDB, 128-256 for PostgreSQL
- Not memory bound &mdash; doubling RAM with 10x data set decreased throughput ~30% (Run #5 vs #4)
- Scaling 4x nodes roughly doubles throughput (Run #6 vs #5)
- Nemesis runs show no accumulated performance degradation (Runs #2, #4)

### Table 2: Latency

| # | Vendor | Avg (ms) | Max (ms) | p99 (ms) |
|---|--------|----------|----------|----------|
| 1 | FDB | 7 | 241 | 45 |
| 2 | FDB+chaos | 8 | 380 | 52 |
| 3 | FDB | 67 | 856 | 201 |
| 4 | FDB+chaos | 71 | 889 | 227 |
| 5 | FDB | 88 | 934 | 271 |
| 6 | FDB | 47 | 565 | 82 |
| 7 | FDB | 151 | 1,267 | 588 |
| 8 | PG | 62 | 4,511 | 203 |
| 9 | PG | 43 | 3,568 | 133 |

### Table 3: Data Set Sizes

| Vendor | Accounts (M) | Transfers (M) | Disk Footprint |
|--------|-------------|---------------|----------------|
| FDB | 10 | 100 | 18 GB |
| FDB | 100 | 100 | 32 GB |
| FDB | 100 | 400 | 88 GB |
| FDB | 1,000 | 10 | 127 GB |
| FDB | 100 | 1,000 | 225 GB |
| PG | 10 | 100 | 71 GB |

### Nemesis Results

Nemesis tests ran on 3-node and 5-node clusters, simulating network partitions and hardware failures:

- Killed one node every two minutes (replaced immediately by Kubernetes operator)
- Choice was fixed for 3-node, random for 5-node clusters
- **Result:** ~5 second availability pause during pod failure (FoundationDB moving coordinator role), then normal operation resumed
- Tests passed with comparable performance and correct resulting balance
- No accumulated degradation observed during continuous failures

## Conclusions

Over hundreds of hours of testing across different clouds, topologies, and adverse actions:

- **ACID verified** &mdash; Unable to make FoundationDB lose transactions under any test condition
- **Fault tolerant** &mdash; Database continued working normally after restoring from degraded state
- **Performance** &mdash; Small cluster comparable to 3-core replicated PostgreSQL
- **Scalability** &mdash; 4x nodes roughly doubled throughput (not linear, but good for correlated workloads)

The cluster doesn't scale linearly, but the result is considered good for the correlated workload of money transfers. Configurations outside scope: larger clusters (hundreds/thousands of cores), different workload types, background activities like backup/restore.
