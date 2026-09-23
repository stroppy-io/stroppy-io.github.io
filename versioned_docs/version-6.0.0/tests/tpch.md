---
sidebar_position: 3
title: TPC-H
sidebar_label: TPC-H
description: TPC-H canonical generation, dialects, parameters, steps, metrics, and validation in Stroppy v6
---

# TPC-H

`tpch/tx` loads all eight TPC-H tables and executes q1–q22. It stresses bulk
loading, scans, joins, aggregation, sorting, filtering, date predicates, and
planner stability.

```bash
stroppy run tpch/tx -d pg --scale-factor 0.01
stroppy run tpch/tx -d mysql --scale-factor 0.01
stroppy run tpch/tx -d pico --scale-factor 0.01
stroppy run tpch/tx -d ydb --scale-factor 0.01
```

## Canonical data generation

Rows come from the retained canonical dbgen implementation through
`pkg/datagen/tpchgen`. The adapter streams typed batches into
`driver.InsertRequest` and supports deterministic partition seeking.

`orders.o_totalprice` is computed while each order and its line items are
generated. V6 has one canonical generation path and no post-load total-price
step.

For scale factor `SF`:

| Table | Rows |
|---|---:|
| `region` | 5 |
| `nation` | 25 |
| `part` | `floor(200,000 × SF)`, minimum 1 |
| `supplier` | `floor(10,000 × SF)`, minimum 1 |
| `partsupp` | 4 per part |
| `customer` | `floor(150,000 × SF)`, minimum 1 |
| `orders` | `floor(1,500,000 × SF)`, minimum 1 |
| `lineitem` | 1–7 per order, about 4 per order |

Order keys follow TPC-H's sparse-key scheme. Canonical seeds and distributions
remain stable across worker counts.

## Parameters

| Flag | Default | Meaning |
|---|---|---|
| `--scale-factor` | `1` | Positive fractional row scale. |
| `--load-workers` | `0` | Load worker count; values below one resolve to one. |
| `--pg-unlogged` | `false` | Opt into PostgreSQL unlogged load. |
| `--ydb-store-mode` | `column` | YDB `column` or `row` schema. |
| `--sql-file` | selected dialect | SQL override. |

Shared flags: `--executor`, `--vus`, `--iterations`, `--duration`, and
`--query-timeout`.

Use `0.01` for a small smoke load:

```bash
stroppy run tpch/tx -d pg --scale-factor 0.01 --load-workers 4 \
  --executor shared-iterations --iterations 1
```

## Steps

| Step | Meaning |
|---|---|
| `drop_schema` | Remove existing tables. |
| `create_schema` | Create dialect schema; YDB can choose column/row layout. |
| `set_unlogged` | Opt-in PostgreSQL pre-load transition. |
| `load_data` | Stream all eight canonical tables. |
| `create_indexes` | Build query-support indexes after load. |
| `set_logged` | Restore PostgreSQL durability after unlogged load. |
| `analyze` | Refresh PostgreSQL/MySQL planner statistics. |
| `validate_answers` | Diagnostic SF=1 PostgreSQL comparison. |
| `workload` | Execute q1–q22 with pinned parameters. |

Load only:

```bash
stroppy run tpch/tx -d pg --scale-factor 1 --load-workers 8 \
  --no-steps workload
```

Query existing data:

```bash
stroppy run tpch/tx -d pg --scale-factor 1 \
  --executor shared-iterations --iterations 1 \
  --steps workload
```

## Dialects

| Driver | SQL asset | Notes |
|---|---|---|
| PostgreSQL | `workloads/tpch/pg.sql` | Full q1–q22 and SF=1 answer comparison. |
| MySQL | `workloads/tpch/mysql.sql` | MySQL 8 rewrites for intervals, rollup, full joins, and casts. |
| Picodata | `workloads/tpch/pico.sql` | sbroad-compatible explicit joins, date bounds, and decorrelated queries. |
| YDB | `workloads/tpch/ydb.sql` | YQL port; column-store schema by default. |

Local override:

```bash
stroppy run tpch/tx ./workloads/tpch/pico.sql -d pico
```

Picodata/YDB date-window ends and Picodata q1 cutoff are computed in Go where
dialect interval expressions are unavailable.

## Query parameters

Parameters use TPC-H §2.4 defaults and are fixed by workload code:

| Query | Selected values |
|---|---|
| q1 | `delta=90` |
| q2 | size 15, BRASS, EUROPE |
| q3 | BUILDING, 1995-03-15 |
| q4 | 1993-07-01 |
| q5 | ASIA, 1994-01-01 |
| q6 | 1994-01-01, discount 0.06, quantity 24 |
| q7 | FRANCE and GERMANY |
| q8 | AMERICA, BRAZIL, ECONOMY ANODIZED STEEL |
| q9 | green |
| q10 | 1993-10-01 |
| q11 | GERMANY, fraction `0.0001 / SF` |
| q12 | MAIL and SHIP, 1994-01-01 |
| q13 | special / requests |
| q14 | 1995-09-01 |
| q15 | 1996-01-01 |
| q16 | Brand#45, MEDIUM POLISHED, fixed size set |
| q17 | Brand#23, MED BOX |
| q18 | quantity 300 |
| q19 | Brand#12/#23/#34, quantities 1/10/20 |
| q20 | forest, CANADA, 1994-01-01 |
| q21 | SAUDI ARABIA |
| q22 | country-code set 13,31,23,29,30,18,17 |

## Metrics

For each q1–q22 Stroppy records:

```text
tpch_qN_duration
tpch_qN_runs
tpch_qN_errors
tpch_qN_elapsed_total
```

Core query metrics also record operation count, errors, and duration. A nonfatal
query error is counted and the suite continues. Final summary therefore exposes
partial/error runs instead of losing all timings after one query.

## Answer comparison

At exactly SF=1 on PostgreSQL, `validate_answers` compares results with
`answers_sf1.json`. Rows are normalized to avoid backend-formatting false
mismatches. Results are diagnostic: `OK`, `DIFF`, `SKIP`, and `ERROR` entries are
logged without changing command exit status.

Other scales and drivers log a validation skip.

The large full SF=1 integration check is separate in source:

```bash
make tmpfs-up
make build
make integration-sf1
make tmpfs-down
```

## Reference data and source

- [`workloads/tpch` at v6.0.0](https://github.com/stroppy-io/stroppy/tree/v6.0.0/workloads/tpch)
- [`pkg/datagen/tpchgen` at v6.0.0](https://github.com/stroppy-io/stroppy/tree/v6.0.0/pkg/datagen/tpchgen)

Regenerate committed distributions and answers only with upstream inputs:

```bash
make gen-tpch-json
```
