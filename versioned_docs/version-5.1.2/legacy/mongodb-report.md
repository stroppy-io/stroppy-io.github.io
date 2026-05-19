---
sidebar_position: 4
title: MongoDB Report
description: Performance and correctness testing of MongoDB with the original Stroppy framework
---

# MongoDB Benchmark Report

:::caution Legacy Documentation
This report was produced using the **original Stroppy framework**. The methodology, test infrastructure, and tooling differ from the current CLI version.
:::

## Introduction

MongoDB is a schema-less document-oriented database. A pioneer of the document data model, MongoDB defined much of what we understand under "NoSQL" databases today.

MongoDB's building block for horizontal scaling is the **replica set** &mdash; a set of nodes each having a full copy of the data, with one taking the leading role. When data outgrows a single replica set, another is added and data is redistributed (sharding).

Query routing and execution is managed by a load balancer and configuration servers. The configuration servers can form their own replica set for high availability. Different node roles make MongoDB cluster configuration trickier but more flexible than homogenous clusters.

### Testing Goals

- Check if MongoDB transactions are ACID
- Check if hardware demands are moderate compared to PostgreSQL and FoundationDB
- Check if the system scales up and out (doubling/quadrupling cores or shards)

## General Results

:::note
1. All tests used MongoDB defaults. Configuration tuning never had noticeable impact.
2. All results refer to MongoDB 4.4. Version 5.0 produced results within error margin. Percona MongoDB Server showed no significant difference.
3. The Community Operator doesn't support sharding. Tests #1-2 used Community Operator; subsequent tests used Percona Operator.
4. Hash-based sharding was used (more even distribution, stable tail latency for non-range workloads).
:::

### Table 1: Key Test Results

| # | VCPU/Node | RAM (GB) | HDD (GB) | Shards | Replicas | Clients | Nodes | Accounts (M) | Transfers (M) | **TPS** |
|---|-----------|----------|----------|--------|----------|---------|-------|---------------|----------------|---------|
| 1 | 1 | 8 | 100 | 1 | 3 | 16 | 3 | 10 | 10 | **340** |
| 2 | 2 | 8 | 100 | 1 | 3 | 16 | 3 | 10 | 10 | **720** |
| 3 | 4 | 8 | 100 | 1 | 3 | 64 | 3 | 10 | 10 | **1,843** |
| 4 | 4 | 8 | 100 | 1 | 3 | 128 | 3 | 10 | 10 | **2,661** |
| 5 | 2 | 8 | 100 | 2 | 3 | 32 | 6 | 10 | 10 | **427** |
| 6 | 6 | 16 | 100 | 1 | 2+arb | 128 | 3 | 100 | 100 | **2,725** |
| 7 | 6 | 16 | 100 | 1 | 3 | 128 | 3 | 100 | 100 | **2,761** |
| 8 | 6 | 12 | 100 | 1 | 2+arb | 128 | 3 | 100 | 100 | **2,592** |
| 9 | 6 | 12 | 100 | 1 | 3 | 128 | 3 | 100 | 100 | **2,551** |
| 10 | 2 | 8 | 100 | 2 | 3 | 128 | 6 | 100 | 100 | **575** |
| 11 | 2 | 8 | 100 | 2 | 3 | 128 | 6 | 100 | 100 | **445** |
| 12 | 4 | 8 | 100 | 8 | 3 | 128 | 12 | 100 | 100 | **1,171** |
| 13 | 8 | 16 | 100 | 2 | 3 | 128 | 6 | 1,000 | 10 | **443** |
| 14 | 8 | 16 | 100 | 4 | 3 | 128 | 12 | 1,000 | 10 | **718** |
| 15 | 8 | 16 | 100 | 4 | 3 | 128 | 12 | 1,000 | 10 | **670** |
| 16 | 4 | 8 | 100 | 8 | 3 | 128 | 12 | 1,000 | 10 | **947** |
| 17 | 12 | 40 | 100 | 1 | 3 | 128 | 3 | 1,000 | 10 | **3,272** |
| 18 | 3 | 8 | 100 | 2 | 3 | 128 | 6 | 10 | 10 | **653** |
| 19 | 3 | 8 | 100 | 2 | 3 | 128 | 6 | 10 | 10 | **534** |

### Table 2: Latencies

| # | Median (ms) | Max (ms) | p99 (ms) |
|---|-------------|----------|----------|
| 1 | 22 | 401 | 79 |
| 2 | 47 | 793 | 178 |
| 3 | 35 | 1,037 | 104 |
| 4 | 45 | 1,807 | 172 |
| 5 | 75 | 800 | 217 |
| 6 | 47 | 2,763 | 173 |
| 7 | 46 | 2,424 | 171 |
| 8 | 49 | 26,515 | 169 |
| 9 | 50 | 2,066 | 221 |
| 10 | 222 | 4,052 | 801 |
| 11 | 287 | 6,372 | 1,434 |
| 12 | 109 | 4,148 | 500 |
| 13 | 288 | 7,293 | 1,099 |
| 14 | 178 | 4,137 | 867 |
| 15 | 190 | 5,917 | 631 |
| 16 | 135 | 5,578 | 898 |
| 17 | 39 | 1,824 | 111 |
| 18 | 195 | 4,990 | 662 |
| 19 | 239 | 2,972 | 657 |

### Table 3: Data Set Sizes

| Accounts (M) | Transfers (M) | MongoDB | FoundationDB |
|--------------|---------------|---------|--------------|
| 10 | 10 | 3 GB | 3 GB |
| 100 | 100 | 24 GB | 32 GB |
| 1,000 | 10 | 136 GB | 127 GB |

### Key Findings

**Scale up, not out.** Transaction performance in MongoDB is bound to the throughput of a single node and does not improve much by adding replica sets.

- For memory-resident workloads (tests #1-#4): doubling cores gives proportional speedup
- Splitting the same compute across replica sets gives *lower* performance (test #5)
- Once data exceeds RAM, performance drops discretely then stabilizes
- Best result (#17): single replica set, 12 cores, 40GB RAM = 3,272 TPS
- CPU-bound on master replica (>80% utilization)

**Sharding insights:**
- Going from 2 to 4 shards with 4x CPU gave only 62% performance gain
- XFS was ~22% faster than EXT4 for memory-bound workloads, 7% slower for disk-bound
- Sharded clusters require separate balancer and config server replica sets (hidden cost)

**Optimal concurrency:** 128 clients (lower than PostgreSQL at 256 or FoundationDB at 512).

## Failover Tests

Tests #18 and #19 used 2-replica-set clusters:

| Scenario | Result |
|----------|--------|
| Restart any replica on any shard every 2 min | **Failed** &mdash; couldn't complete data loading |
| Restart one predefined replica on one shard every 2 min | **Failed** &mdash; couldn't complete data loading |
| Disconnect one predefined replica on one shard every 2 min | **Failed** &mdash; TransactionExceededLifetimeLimitSeconds |
| Restart one predefined replica on *different* shards every 2 min | **Passed** (test #18) |
| 100% network degradation between two replicas on same shard every 2 min | **Passed** (test #19) |

Brief network partitions don't cause noticeable degradation. However, more aggressive failure scenarios prevented test completion.

## Final Remarks

1. Default durability must be elevated to `w:majority` with `wtimeout` on. Without this, inconsistent data was observed.
2. Multi-document transactions must read from the master and use `writeConcernMajorityJournalDefault`.
3. WiredTiger uses MVCC, but MongoDB's query layer adds multi-granularity locking (possibly legacy from MMAPv1).

## Conclusions

Over 100 test runs in 3 months. Comparison with FoundationDB and PostgreSQL:

| Comparison | MongoDB | Competitor | Ratio |
|-----------|---------|------------|-------|
| Test #1 (minimal config) | 340 TPS | FDB: 2,263 TPS | **6.7x slower** |
| Test #5 (small scale-out) | 427 TPS | FDB: ~2,200 TPS | **~5x slower** |
| Test #7 (medium, best single RS) | 2,761 TPS | FDB: 5,782 TPS | **2.1x slower** |
| Test #7 (medium, best single RS) | 2,761 TPS | PG: ~4,663 TPS | **1.7x slower** |
| Test #17 (big, best overall) | 3,272 TPS | FDB: 3,369 TPS | **Comparable** |
| Test #17 hardware | 36 cores, 120GB RAM | FDB: 5 cores, 60GB RAM | **7x more resources** |

For multi-document transaction workloads, MongoDB scales best vertically. Even in large clusters, CPU and disk were near 100% utilization. Horizontal scaling showed sub-linear improvement insufficient to justify the added complexity.
