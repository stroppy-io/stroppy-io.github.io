---
sidebar_position: 4
title: TPC-DS
sidebar_label: TPC-DS
description: TPC-DS canonical generation, query streams, dialect limits, parameters, and validation in Stroppy v6
---

# TPC-DS

`tpcds` loads all 24 TPC-DS tables and runs the 99-query suite. Queries 14, 23,
24, and 39 have two parts, so the baked set contains 103 SQL statements.

TPC-DS stresses wide fact tables, snowflaked dimensions, joins, aggregation,
sorting, subqueries, and window functions.

## Driver support

| Driver | Load | Baked queries | Generated streams | Answer comparison |
|---|---:|---:|---:|---:|
| PostgreSQL | yes | 103 statements | yes | yes |
| MySQL | yes | 103 statements | yes, with exclusions below | yes |
| YDB | yes | 103 YQL statements | no | no |
| Picodata | yes | **not supported** | no | no |

Picodata is load-only in v6. Its schema and typed bulk-load path work, but
sbroad cannot execute the TPC-DS query templates reliably. Always omit the
workload step:

```bash
stroppy run tpcds -d pico --scale-factor 0.1 --no-steps workload
```

## Canonical data generation

Rows come from the retained dsdgen implementation through
`pkg/datagen/tpcdsgen`. The typed batch adapter preserves canonical text output,
null semantics, ticket fan-out, and deterministic partition seeking.

```bash
stroppy run tpcds -d pg --scale-factor 0.1 --load-workers 8
```

Some static dimensions do not shrink with scale. `customer_demographics`, for
example, remains about 1.9 million rows, so fractional smoke loads are still
substantial.

## Parameters

| Flag | Default | Meaning |
|---|---|---|
| `--scale-factor` | `1` | Positive fractional row scale. |
| `--load-workers` | `0` | Workers per table load. |
| `--pg-unlogged` | `false` | Opt into PostgreSQL unlogged load. |
| `--ydb-store-mode` | `column` | YDB `column` or `row` schema. |
| `--streams` | `1` | Number of generated query streams. |
| `--query-stream` | unset | Explicit generated stream number. |
| `--query-seed` | `19620718` | Generated-stream seed. |
| `--schema-file` | selected dialect | Schema override. |
| `--sql-file` | selected dialect | Query override. |
| `--validate-force` | `false` | Compare SF=1 references outside SF=1. |

Shared flags: `--executor`, `--vus`, `--iterations`, `--duration`, and
`--query-timeout`.

## Steps

| Step | Meaning |
|---|---|
| `drop_schema` | Remove existing tables. |
| `create_schema` | Create dialect schema; YDB may choose column layout. |
| `set_unlogged` | Opt-in PostgreSQL pre-load transition. |
| `load_data` | Stream all 24 tables. |
| `create_indexes` | Build post-load indexes. |
| `set_logged` | Restore PostgreSQL durability. |
| `analyze` | Refresh PostgreSQL/MySQL planner statistics. |
| `validate_answers` | Diagnostic baked-set comparison on PostgreSQL/MySQL. |
| `workload` | Execute selected baked/generated query stream. |

Load then query:

```bash
stroppy run tpcds -d pg --scale-factor 1 --load-workers 8 \
  --no-steps workload

stroppy run tpcds -d pg --scale-factor 1 \
  --executor shared-iterations --iterations 1 \
  --steps workload
```

## Baked power set

With no explicit `--query-stream` and `--streams=1`, the workload uses
checked-in qualification parameters.

```bash
stroppy run tpcds -d pg --scale-factor 1 \
  --executor shared-iterations --iterations 1
```

Dialect assets:

| Driver | Schema | Queries |
|---|---|---|
| PostgreSQL | `schema.pg.sql` | `pg.sql` |
| MySQL | `schema.mysql.sql` | `mysql.sql` |
| YDB | `schema.ydb.sql` | `ydb.sql` |
| Picodata | `schema.pico.sql` | query execution unsupported |

YDB column store is default and intended for this scan-heavy workload.

## Generated query streams

On PostgreSQL/MySQL, select one reproducible generated stream:

```bash
stroppy run tpcds -d pg --scale-factor 1 \
  --query-stream 0 --query-seed 42
```

Or assign generated streams across concurrent VUs:

```bash
stroppy run tpcds -d pg --scale-factor 1 --streams 4 \
  --executor constant-vus --vus 4 --duration 10m
```

PostgreSQL generated streams cover all 99 query templates. MySQL generated
streams omit q51, q88, and q97; those queries remain present and verified in the
baked MySQL set. YDB and Picodata reject generated streams.

The in-process generator uses valid, scale-aware parameter domains and a
reproducible seed. It does not claim byte-identical parameter streams with the
reference C `dsqgen`.

A standalone generator remains available in source:

```bash
make gen-tpcds-streams
```

## Answer comparison

The baked set can be compared with embedded SF=1 answers on PostgreSQL and
MySQL. Results are treated as multisets with numeric tolerance so null/tie
ordering differences do not become false mismatches.

`--validate-force=true` runs the same SF=1 references outside SF=1; resulting
differences are expected unless data matches that reference scale.

Validation is diagnostic. Query errors and answer deltas are logged but do not
change exit status.

Generated/throughput streams do not run the baked answer-comparison step.

## Metrics and errors

TPC-DS uses core native query/load metrics:

```text
run_query_operations_total
run_query_errors_total
run_query_duration
insert_operations_total
insert_errors_total
insert_duration
insert_rows_total
failed_queries_total
terminal_errors_total
```

A nonfatal query error is counted and the query set continues. Final output
shows `bench completed with errors` when any query terminates with an error.

## Benchmark coverage

This workload supplies:

- database load;
- serial power-query execution;
- concurrent generated query-stream building blocks.

It does not implement TPC-DS data-maintenance phases or compute QphDS@SF.

## SQL overrides

Override both schema and queries through typed flags:

```bash
stroppy run tpcds -d pg \
  --schema-file ./schema.custom.sql \
  --sql-file ./queries.custom.sql
```

Explicit local paths use current working directory first.

## Reference source

- [`workloads/tpcds` at v6.0.0](https://github.com/stroppy-io/stroppy/tree/v6.0.0/workloads/tpcds)
- [`pkg/datagen/tpcdsgen` at v6.0.0](https://github.com/stroppy-io/stroppy/tree/v6.0.0/pkg/datagen/tpcdsgen)
