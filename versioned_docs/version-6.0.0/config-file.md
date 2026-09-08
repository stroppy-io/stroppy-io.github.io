---
sidebar_position: 5
title: Configuration Files
description: Typed Stroppy v6 run, workload, driver, logging, and OTLP configuration
---

# Configuration Files

`stroppy run` loads repeatable settings from JSON. By default it reads
`stroppy-config.json` in the current directory when that file exists. Use `-f`
for another path.

```bash
stroppy run
stroppy run -f prod.json
stroppy run -f prod.json tpcc/tx
stroppy run -f prod.json ./queries.sql
```

The file is decoded strictly and recursively. Unknown, duplicate, colliding,
mis-cased, malformed, and trailing input is rejected.

## Envelope

```json
{
  "version": "1",
  "script": "tpcc/tx",
  "sql": "",
  "global": {},
  "drivers": {},
  "run": {},
  "params": {},
  "env": {},
  "steps": [],
  "noSteps": []
}
```

| Field | Type | Purpose |
|---|---|---|
| `version` | string | Config envelope version; currently `"1"`. |
| `script` | string | Registered workload, `.sql` path, or inline SQL. |
| `sql` | string | Explicit SQL override for a registered workload. |
| `global` | object | Run identity, seed, metadata, logger, and exporter. |
| `drivers` | object | Driver configs keyed by index (`"0"`, `"1"`, ...). |
| `run` | object | Typed executor, VU, iteration, duration, and query-timeout values. |
| `params` | object | Typed parameters declared by selected workload. |
| `env` | object | String-valued compatibility inputs. |
| `steps` | string array | Step allowlist. |
| `noSteps` | string array | Step blocklist. |

`steps` and `noSteps` are mutually exclusive after all config and CLI sources
are merged.

## Complete TPC-C example

```json
{
  "version": "1",
  "script": "tpcc/tx",
  "global": {
    "version": "1",
    "runId": "tpcc-postgres-10w",
    "seed": 1,
    "metadata": {
      "environment": "staging",
      "owner": "database-team"
    },
    "logger": {
      "logLevel": "info",
      "logMode": "production"
    },
    "exporter": {
      "name": "otlp",
      "otlpExport": {
        "otlpGrpcEndpoint": "otel-collector:4317",
        "otlpEndpointInsecure": true,
        "otlpMetricsPrefix": "stroppy_"
      }
    }
  },
  "drivers": {
    "0": {
      "driverType": "postgres",
      "url": "postgres://bench:bench@db:5432/tpcc",
      "defaultInsertMethod": "native",
      "pool": {
        "maxConns": 200,
        "minConns": 20
      },
      "insertProgress": {
        "enabled": true,
        "interval": "30s",
        "stallAfter": "2m",
        "mode": "both"
      }
    }
  },
  "run": {
    "executor": "constant-vus",
    "vus": 64,
    "duration": "30m",
    "queryTimeout": "5s"
  },
  "params": {
    "scaleFactor": 10,
    "loadWorkers": 8,
    "retryAttempts": 3,
    "pacing": false,
    "pgUnlogged": false
  }
}
```

Run it:

```bash
stroppy run -f stroppy-config.json
```

Override one typed value:

```bash
stroppy run -f stroppy-config.json --duration 5m
```

## Typed `run` values

Every registered workload accepts:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `executor` | string | `shared-iterations` | `shared-iterations` or `constant-vus`. |
| `vus` | integer | `1` | Virtual users. |
| `iterations` | integer | `1` | Total shared iterations. |
| `duration` | duration string | `"0s"` | Constant-VU duration. |
| `queryTimeout` | duration string | `"0s"` | Per-statement deadline; zero disables it. |

`constant-vus` requires positive `vus` and `duration`. `shared-iterations`
requires positive `iterations` and `vus`.

## Typed workload `params`

Names and types depend on `script`. Examples:

```json
{
  "script": "tpcb/tx",
  "params": {
    "scaleFactor": 10,
    "loadWorkers": 8,
    "retryAttempts": 3,
    "txIsolation": "read_committed"
  }
}
```

```json
{
  "script": "tpcds",
  "params": {
    "scaleFactor": 0.1,
    "loadWorkers": 8,
    "streams": 4,
    "querySeed": 19620718,
    "ydbStoreMode": "column",
    "validateForce": false
  }
}
```

Unknown names are rejected after the selected workload declares its schema.
Inspect exact names with:

```bash
stroppy run tpcds --help
stroppy probe -o json
```

## Driver objects

Each `drivers` value supports:

| Field | Type | Meaning |
|---|---|---|
| `driverType` | string | `postgres`, `mysql`, `picodata`, `ydb`, `noop`, or `csv`. |
| `url` | string | Connection URL, DSN, or CSV output path. |
| `defaultInsertMethod` | string | Fallback method when workload leaves method unset. |
| `bulkSize` | integer | Rows per SQL/native batch. |
| `pool` | object | Portable pool fields mapped by driver type. |
| `postgres` | object | pgx-specific pool/query fields. |
| `sql` | object | `database/sql` pool fields. |
| `insertProgress` | object | Load progress reporting. |
| `caCertFile` | string | CA certificate path. |
| `authToken` | string | Token credential. |
| `authUser` / `authPassword` | string | Static credentials. |
| `tlsInsecureSkipVerify` | boolean | Skip TLS verification for testing. |

Portable pool fields:

```json
{
  "pool": {
    "maxConns": 100,
    "minConns": 10,
    "maxConnLifetime": "1h",
    "maxConnIdleTime": "10m"
  }
}
```

PostgreSQL-specific fields include `traceLogLevel`, `minIdleConns`,
`defaultQueryExecMode`, `descriptionCacheCapacity`, and
`statementCacheCapacity`. `database/sql` fields include `maxOpenConns`,
`maxIdleConns`, `connMaxLifetime`, and `connMaxIdleTime`.

Explicit `postgres` or `sql` objects override portable `pool` values.

`defaultInsertMethod` is a fallback only. A method selected by the workload's
`driver.InsertRequest` wins.

See [Drivers & Configuration](./drivers).

## Insert progress

```json
{
  "insertProgress": {
    "enabled": true,
    "interval": "10s",
    "stallAfter": "60s",
    "mode": "both"
  }
}
```

Modes: `off`, `log`, `metrics`, `both`.

## Logging

```json
{
  "global": {
    "logger": {
      "logLevel": "info",
      "logMode": "production"
    }
  }
}
```

Levels: `debug`, `info`, `warn`, `error`, `fatal`. Modes: `development`,
`production`. V5 enum names and valid numeric ordinals remain accepted.
Defaults are `debug` and `development`.

Logging precedence:

1. `--log-level` / `--log-mode`;
2. process `LOG_LEVEL` / `LOG_MODE`;
3. `-e LOG_LEVEL=...` / `-e LOG_MODE=...`;
4. `global.logger`;
5. defaults.

Database URLs printed in configuration diagnostics redact passwords, tokens,
secrets, credentials, and API-key values.

## OpenTelemetry export

Configure either gRPC or HTTP. Endpoint fields use `host:port` without a URL
scheme. When both exist, gRPC wins.

```json
{
  "global": {
    "exporter": {
      "name": "otlp",
      "otlpExport": {
        "otlpHttpEndpoint": "otel-collector:4318",
        "otlpHttpExporterUrlPath": "/v1/metrics",
        "otlpEndpointInsecure": true,
        "otlpHeaders": "authorization=Bearer token",
        "otlpMetricsPrefix": "stroppy_"
      }
    }
  }
}
```

`OTEL_METRIC_EXPORT_INTERVAL` controls export interval in milliseconds; default
is 10000. With no endpoint, metrics still appear in the terminal summary.

## Compatibility aliases and validation

Exact lower-camel names are canonical. Established v5 snake_case aliases remain
accepted, for example:

```text
no_steps
global.run_id
drivers.*.bulk_size
run.query_timeout
```

Do not set canonical and alias forms together. Field-name case is significant.
Former int32 fields accept numeric or quoted decimal/exponent forms only when
the value is exactly integral and in range. `global.seed` accepts null or a
bare unsigned JSON integer only.

Removed fields such as `k6Args`, `k6Config`, `errorMode`, and
`defaultTxIsolation` are rejected as unknown. See [Migrating to v6](./migration-v6).

Generated schema:

- [v6.0.0 JSON Schema](https://github.com/stroppy-io/stroppy/blob/v6.0.0/docs/jsonschema/run.schema.json)

## Precedence

Typed parameters, highest first:

1. typed CLI flag;
2. process environment;
3. `-e` compatibility value;
4. matching `run` or `params` value;
5. config `env` map;
6. declared default.

Other precedence:

- workload and SQL positionals override `script` and `sql`;
- CLI `--steps`/`--no-steps` override matching file list;
- CLI `-d`/`-D` override file `drivers`.
