---
sidebar_position: 2
title: User Guide (Legacy)
description: Original Stroppy framework user guide - cloud deployment, commands, data model
---

# User Guide (Legacy)

:::caution Legacy Documentation
This is the user guide for the **original Stroppy framework**. For the current CLI tool, see the [Introduction](/docs/introduction).
:::

## Introduction

[Stroppy](http://github.com/picodata/stroppy) was a framework for testing various databases. It allowed you to deploy a cluster in the cloud, run load tests and simulate, for example, network unavailability of one of the nodes in the cluster.

The "banking" test verified data integrity: fill the database with accounts, simulate parallel money transfers, then verify the total balance hasn't changed. To complicate the task, Stroppy could deliberately break the DB cluster using chaos testing.

Supported databases: FoundationDB, MongoDB, CockroachDB and PostgreSQL.

**Important**: This instruction was relevant for Ubuntu OS >=18.04.

## Commands

### Common base keys

- `log-level` &mdash; Logging level: trace, debug, info, warn, error, fatal, panic
- `dbtype` &mdash; DBMS name: `postgres`, `fdb`, `mongodb`, `cockroach`
- `url` &mdash; Connection string to the database

### Cluster deployment (`deploy`)

- `cloud` &mdash; Cloud provider: `yandex` or `oracle`
- `flavor` &mdash; Configuration from templates.yaml: small, standard, large, xlarge, xxlarge, maximum
- `nodes` &mdash; Number of VM cluster nodes
- `dir` &mdash; Directory with configuration files

```bash
./bin/stroppy deploy --cloud oracle --flavor small --nodes 3 \
  --dir docs/examples/deploy-oracle-3node-2cpu-8gbRAM-100gbStorage --log-level debug
```

### Account loading (`pop`)

- `count, n` &mdash; Number of accounts (default: 100000)
- `workers, w` &mdash; Number of workers (default: 4 * runtime.NumCPU())
- `banRangeMultiplier, r` &mdash; BIC/BAN ratio coefficient (default: 1.1)
- `stat-interval, s` &mdash; Statistics interval (default: 10s)
- `sharded` &mdash; Use sharding for MongoDB (default: false)
- `add-pool, a` &mdash; Additional connection pool size (default: 0)

```bash
./bin/stroppy pop --url fdb.cluster --count 5000 --w 512 --dbtype=fdb
```

### Money transfers (`pay`)

- `zipfian` &mdash; Use Zipfian distribution (default: false)
- `check` &mdash; Verify balance after test (default: true)

```bash
./bin/stroppy pay --url fdb.cluster --check --count=100000
```

### Chaos testing

- `kube-master-addr` &mdash; Internal IP of the k8s master node
- `chaos-parameter` &mdash; Chaos-mesh script name (without .yaml)

```bash
./bin/stroppy pay --url fdb.cluster --check --count=100000 \
  --kube-master-addr=10.1.20.109 --chaos-parameter=fdb-cont-kill-first
```

## Ban Range Multiplier

The `banRangeMultiplier` (brm) defines the ratio of BAN (Bank Account Number) per BIC (Bank Identifier Code):

- Number of BICs ≈ sqrt(count)
- Number of BANs = (Nbic * brm) / sqrt(count)
- If Nban * Nbic > count, more (BIC, BAN) combinations are generated than stored
- Recommended range: 1.01 to 1.1

## Testing Scenario

### Stage 1: Account Loading

Accounts are generated using a built-in generator that may produce duplicates. Only unique records are stored. The number of successfully uploaded records matches the specified count.

```
[Nov 17 15:23:07.334] Done 10000 accounts, 0 errors, 16171 duplicates
[Nov 17 15:23:07.342] Total time: 21.378s, 467 t/sec
[Nov 17 15:23:07.342] Latency min/max/avg: 0.009s/0.612s/0.099s
[Nov 17 15:23:07.342] Latency 95/99/99.9%: 0.187s/0.257s/0.258s
[Nov 17 15:23:07.344] Calculating the total balance...
[Nov 17 15:23:07.384] Persisting the total balance...
[Nov 17 15:23:07.494] Total balance: 4990437743
```

### Stage 2: Money Transfers

Parallel transfers between accounts. Workers encountering retryable errors pause briefly and retry with a new account.

```
[Oct 15 16:11:12.872] Total time: 26.486s, 377 t/sec
[Oct 15 16:11:12.872] Latency min/max/avg: 0.001s/6.442s/0.314s
[Oct 15 16:11:12.872] Latency 95/99/99.9%: 0.575s/3.268s/6.407s
[Oct 15 16:11:12.872] Errors: 0, Retries: 0, Recoveries: 0, Not found: 1756, Overdraft: 49
[Oct 15 16:11:12.872] Calculating the total balance...
[Oct 15 16:11:12.922] Final balance: 4930494048
```

### Stage 3: Balance Verification

Total balance is compared with the stored canonical result.

**Counters:**
- `Duplicates` &mdash; Data duplication errors (account loading)
- `Not found` &mdash; Account not found in database (transfers)
- `Overdraft` &mdash; Insufficient balance for transfer amount
- `Retries` &mdash; Operations retried after transient errors
- `Errors` &mdash; Fatal errors that stopped a worker

## The Data Model

Using PostgreSQL as an example:

| Table | Column | Description |
|-------|--------|-------------|
| **account** | bic | Account BIC (TEXT) |
| | ban | Account BAN (TEXT) |
| | balance | Account balance (DECIMAL) |
| **transfers** | transfer_id | Transfer ID (UUID) |
| | src_bic | Source BIC (TEXT) |
| | src_ban | Source BAN (TEXT) |
| | dst_bic | Destination BIC (TEXT) |
| | dst_ban | Destination BAN (TEXT) |
| | amount | Transfer amount (DECIMAL) |
| **checksum** | name | Balance name (TEXT) |
| | amount | Balance value (DECIMAL) |
| **settings** | key | Parameter name (TEXT) |
| | value | Parameter value (TEXT) |

Primary key for accounts: (bic, ban). Primary key for transfers: transfer_id (UUID).

For PostgreSQL and MongoDB, the transfer method implemented lock order control via lexicographic comparison of BIC/BAN pairs to prevent deadlocks.

## Compilation and Build

Three build options were available:

### 1. Run from ready container

Required a compiled Stroppy binary. Used the pre-built container from the repository.

### 2. Build container without compilation

Required Docker. Built the container from the Dockerfile in the repository.

### 3. Compile from source

Required Go, make, gcc, Docker, FoundationDB client libraries, and Terraform.

```bash
git clone git@github.com:picodata/stroppy.git
cd stroppy
make all
```

## Deployment in Minikube

For local testing, Stroppy could be deployed in Minikube with PostgreSQL:

```bash
minikube config set memory 6144
minikube config set cpus 4
minikube start

git clone https://github.com/picodata/stroppy.git && cd stroppy
make all

kubectl apply -f docs/examples/deploy-minikube-local/cluster/stroppy-secret.yaml
kubectl apply -f docs/examples/deploy-minikube-local/cluster/stroppy-manifest.yaml
./docs/examples/deploy-minikube-local/databases/postgres/deploy_operator.sh

KUBE_MASTER_ADDR="$(minikube ip)"
kubectl exec --stdin --tty stroppy-client -- \
  env KUBE_MASTER_ADDR="$KUBE_MASTER_ADDR" /bin/bash

# Inside stroppy-client:
stroppy pop --url postgres://stroppy:stroppy@acid-postgres-cluster/stroppy?sslmode=disable \
  --count 5000 --run-as-pod --kube-master-addr="$KUBE_MASTER_ADDR" --dir .
```

## Usage Notes

1. Oracle.Cloud and Yandex.Cloud had different deployment procedures (node counting, disk mounting)
2. FoundationDB required manual copying of `fdb.cluster` file between pods
3. Monitoring archive creation took ~30 minutes
4. FoundationDB statistics were collected via `status json` command
5. Multiple clusters required separate repository copies to avoid configuration conflicts
