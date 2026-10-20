---
sidebar_position: 5
title: Banking
sidebar_label: Banking
description: The banking invariant workload — token-witnessed transfers, invariant checks, and fault injection at commit
---

# Banking

`banking` moves money between two accounts and **fails the run when the invariant
breaks**. Unlike a throughput benchmark, its subject is a promise rather than a rate:
after any number of concurrent transfers — and through faults injected at the moment
of commit — the total balance is unchanged and every account still holds exactly one
of the tokens `1..accounts`.

```bash
stroppy run banking -d pg \
  --executor constant-vus --vus 8 --duration 2m --accounts 1000
```

:::warning Banking verification in 6.2.0

Verification retries all check errors, including an observed wrong balance or token
permutation. If a later check succeeds, the run can report success. Until
[#217](https://github.com/stroppy-io/stroppy/issues/217) is fixed, do not treat a
successful run as conclusive corruption-test evidence. Persistent mismatches still
fail. The witness limitations below apply independently of this bug.
:::

## A second witness

Every transfer swaps a `UNIQUE` token between the two rows it touches, as well as
moving the money — so the two invariants cover different failures. Both are
*conservation* properties, and **neither proves that every intended transfer happened
exactly once**: a whole transfer that is lost, or a whole one applied twice, leaves the
money conserved and the tokens where they were, and is invisible to both.

| What goes wrong | `sum(balance)` | token permutation |
|---|---|---|
| a one-sided balance update, its token write missing | **caught** — the total changes | missed |
| a complete debit and credit with no token swap (1000/1000 → 990/1010) | missed — the total is unchanged | missed — the tokens are untouched |
| the swap runs only in part: a row parks in the sentinel, or two rows hold the same token | missed | **caught** |
| a whole transfer is lost, or a whole one applied twice | missed | missed |

`verify` asserts both: `sum(balance) = accounts × 1000`, and that the tokens are still
a permutation of `1..accounts`.

The swap is **three conditional writes rather than two**, because the `UNIQUE`
constraint is immediate and both rows would otherwise want a token at once: the first
row parks its token in a sentinel (the negative of its own id — outside `1..accounts`,
and unique to that row), and picks the other's token up last. Each write is conditional
on the value read, which turns a concurrent transfer into a detected conflict rather
than a silent overwrite.

## How it loads a cluster

![How one iteration stresses the cluster, and where the fault injector sits](/img/banking-injection.svg)

Every VU runs the loop above, concurrently, choosing accounts at random — so
neighbouring rows are touched by different VUs at the same time. The conflicts that
follow are not incidental: they are the load this workload applies. The retry policy
absorbs them, and the run's counters separate three things worth keeping apart:

| Counter | Meaning |
|---|---|
| `terminal_errors_total` | transfers that exhausted their retry budget |
| `retry_attempts_total` | retries the policy scheduled — conflicts and injected faults alike |
| `tx_commits_total` | transactions that actually committed |

Terminal errors with exit status 0 are common here, **but they are not all contention**. A
missing `GRANT` on the injector's arm function, or an asset that does not fit the engine,
produces the same shape: failed iterations, exit 0, and a `verify` that passes because the
data was never touched. Read the error groups rather than assuming, and note that
`retry_attempts_total` counts *scheduled* retries, which injected faults and conflicts
alike produce.

## Variants

| Workload | Execution | Drivers |
|---|---|---|
| `banking` | transfers, no faults | PostgreSQL, MySQL, CockroachDB, YugabyteDB, TiDB, Picodata (reduced), YDB |
| `banking/inject` | transfers with faults injected at commit | PostgreSQL with Macavity |

## Where injection points play their role

`banking/inject` fails commits on purpose, so the invariant is checked against
*interruption* rather than only against contention. It needs a fault injector inside
the server, and uses [Macavity](https://github.com/stroppy-io/Macavity), which hooks
supported callbacks — nothing in PostgreSQL is patched or rebuilt.

| Point | What it interrupts |
|---|---|
| `before_commit` | the moment before the commit record is written — **the default, and the one that matters here** |
| `before_abort` | transaction abort processing |
| `executor_start` | after the executor is initialized, before any tuples |
| `executor_end` | as the executor finishes |

`before_commit` is where a commit is decided, which is why it is the default. The two
actions produce different situations, and the difference matters:

- `error` aborts the transaction *before* the commit record is written, so the attempt
  is unambiguously not committed. A client that retries it loses nothing.
- `crash` sends SIGKILL from the same pre-commit moment, so the faulted transfer does
  not commit either. What the client loses is the *knowledge*, not the certainty — and
  the genuinely uncertain outcomes belong to the *other* sessions that recovery tears
  down with work in flight.

An injected error fails an **attempt**, not necessarily the **iteration**: the injector is
armed once per iteration, so a retry follows it and commits. Only when the retries are
exhausted does an injected fault become a failed iteration.

```bash
stroppy run banking/inject -d pg \
  -D url=postgres://postgres@localhost:5432/scratch \
  --executor constant-vus --vus 4 --duration 30s \
  --inject-action error --inject-every 25
```

| Flag | Default | Meaning |
|---|---|---|
| `--inject-point` | `before_commit` | Which fault point to arm. |
| `--inject-action` | `error` | `error` fails the commit; `crash` kills the backend. |
| `--inject-occurrence` | `1` | Which matching hit fires, counted from the arming transaction. |
| `--inject-every` | `25` | Arm the injector every Nth transfer; `0` disables injection. |

**The injector is armed once per iteration, never once per attempt.** The armed event
is one-shot: re-arming inside the retry loop would fail every attempt of that
iteration and no retry could ever absorb the fault. Measured — a rejected `COMMIT`
leaves the transaction aborted and nothing behind, an attempt fails, and the next
attempt commits once, which is the machinery the invariant is being checked through.

**`error` and `crash` are different instruments.** `error` is the one a pipeline can
gate on: a rejected commit fails an attempt, the retry normally commits, the run exits
0, and `verify` decides. `crash` SIGKILLs the backend so the postmaster reinitializes
the cluster, and a run under it cannot finish: measured, a 10-second run at `--inject-every 5` attempted
10156 iterations, **10146 failed**, only 10 committed, and the run **exits non-zero**.
The invariants still held after every crash — which is what that variant exists to
show. Point it at a disposable database.

## Drivers

| Dialect | Asset | Notes |
|---|---|---|
| PostgreSQL | `pg.sql` | also selected by CockroachDB, unless its own asset applies |
| MySQL | `mysql.sql` | also selected by TiDB |
| CockroachDB | `pg.sql` | no engine-specific asset needed |
| YugabyteDB | `pg.sql` | no engine-specific asset needed |
| TiDB | `mysql.sql` | no engine-specific asset needed |
| YDB | `ydb.sql` | unique index declared `GLOBAL UNIQUE SYNC` |
| Picodata | `pico.sql` | **reduced**: see below |

**Picodata carries a reduced asset, and the run says so.** Unique indexes there are
limited to sharding-key columns, so a constraint on the token is not expressible; and
transactions are single-bucket `DO` blocks, while a transfer's two rows are two
sharding keys — so the swap cannot be made atomic. That dialect moves the money and
checks the total only, and the run's report data records what is therefore not
detectable under `token_witness`.

## Parameters

| Flag | Default | Meaning |
|---|---|---|
| `--accounts` | `100` | Account count; the invariant is `accounts × 1000`. |
| `--retry-attempts` | `3` | Maximum transaction attempts. |
| `--tx-isolation` | driver-derived | Isolation override. |
| `--sql-file` | selected dialect | SQL override by filesystem path. |

Default isolation is `read_committed`; YDB is `serializable`, and Picodata takes none.

## Steps

| Step | Meaning |
|---|---|
| `drop_schema` | Remove the table. |
| `create_schema` | Create `bank_account`. |
| `load_data` | Fill every account with its initial balance and its own token. |
| `transfer` | The measured loop: money and tokens move together. |
| `verify` | Assert both invariants, waiting out a server that is still recovering. |

`banking/inject` adds `setup_injection`, which creates the extension and fails early
when the injector is missing rather than mid-run.

## Integration coverage

The v6 repository runs `banking/inject` in CI, on every push: a job installs
PostgreSQL with matching headers, builds Macavity from the audited fork commit, creates
the extension, and runs the variant with faults injected at commit. The workload's own
`verify` step is what decides that job.

The extension is built, never fetched prebuilt, because it is a `.so` that has to match
the server's ABI. `make macavity` and `make macavity-install` do it locally.

Reference implementation:

- [`workloads/banking`](https://github.com/stroppy-io/stroppy/tree/v6.2.0/workloads/banking)
