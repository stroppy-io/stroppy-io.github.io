---
sidebar_position: 1
title: Historical Overview
description: Overview of the original Stroppy framework (pre-CLI rewrite)
---

# Historical Overview

:::caution Legacy Documentation
This section documents the **original Stroppy framework** &mdash; a cloud-based database testing platform with Kubernetes deployment, Terraform provisioning, and Grafana integration. This version has been superseded by the current CLI tool.

The content is preserved here for historical reference and for users who may still encounter the original framework.
:::

## What Was Stroppy (v1)?

Stroppy was a framework for testing various types of databases. It allowed you to deploy a cluster in the cloud, run load tests and simulate different failures, such as network unavailability of one of the nodes in the cluster.

To complicate the task for the DBMS, Stroppy could deliberately break the DB cluster, because in the real world failures happen much more often than we want. And for horizontally scalable databases this happens even more often, since a larger number of physical nodes gives more points of failure.

Support was implemented for **FoundationDB**, **MongoDB**, **CockroachDB** and **PostgreSQL** (used as a system-wide measure to compare everything else with).

Stroppy was integrated with **Grafana** for test result analysis. After each run it automatically collected an archive with the database metrics, scaled by the time of running.

## Main Features

- Deployment of a cluster of virtual machines in the selected cloud via Terraform (Yandex.Cloud and Oracle.Cloud)
- Deployment of a Kubernetes cluster inside the VM cluster
- Deployment of the selected DBMS in the running cluster
- Collecting statistics from Grafana (k8s cluster metrics and VM system metrics: CPU, RAM, storage)
- Managing test parameters and deployment configuration
- Running tests on demand from CLI
- Logging of test progress (current and final latency, RPS)
- Deleting a cluster of virtual machines
- Deployment of multiple clusters from a single local machine with isolated monitoring

## The Banking Test

The core test methodology was an elegant "banking" integrity test:

1. **Account Loading** &mdash; Fill the database with records about bank accounts with initial balances. Calculate and store the total balance as a canonical/expected result.

2. **Money Transfers** &mdash; Simulate a series of parallel transfers from one account to another within DBMS transactions. Transfers run concurrently and can use the same source or target account.

3. **Balance Verification** &mdash; Calculate the total balance of all accounts after transfers. The total must not change, regardless of failures, network partitions, or concurrent access.

This test verified both ACID properties and performance under stress, including chaos testing with [chaos-mesh](https://chaos-mesh.org/).

## Supported Databases

| Database | Status | Notes |
|----------|--------|-------|
| PostgreSQL | Reference baseline | Used for comparison |
| FoundationDB | Fully tested | See [FoundationDB Report](./fdb-report) |
| MongoDB | Fully tested | See [MongoDB Report](./mongodb-report) |
| CockroachDB | Partially tested | Limited results |

## How It Differs from Current Stroppy

| Aspect | Original (v1) | Current v6 CLI |
|--------|---------------|----------------|
| Deployment | Cloud VMs via Terraform + Kubernetes | Self-contained CLI or container |
| Workloads | Fixed Go banking workload | Registered Go TPC-B/C/H/DS and SQL workloads |
| Load engine | Custom goroutine pool | Native typed executor with virtual users |
| Database support | FDB, MongoDB, CockroachDB, PostgreSQL | PostgreSQL, MySQL, Picodata, YDB, Noop, CSV |
| Data generation | Built-in banking model | Deterministic typed batches and canonical TPC adapters |
| Reporting | Grafana metrics archives | Terminal summaries and optional OpenTelemetry export |
| Infrastructure | Required cloud accounts | Runs against user-managed databases anywhere |

Current Stroppy focuses on reproducible database workloads and client-side
measurement. It does not provision clusters or inject infrastructure failures.
See the [Introduction](../introduction) for v6.
