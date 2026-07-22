---
sidebar_position: 4
title: Configuration Files
description: Load Stroppy run and probe settings from stroppy-config.json
---

# Configuration Files

Stroppy can load run and probe settings from a JSON config file. This is useful for repeatable benchmark runs where driver settings, script parameters, steps, and k6 arguments would otherwise become a long shell command.

By default, `stroppy run` and `stroppy probe` look for `./stroppy-config.json` in the current directory. Use `-f` or `--file` to load a different file:

```bash
stroppy run                         # uses ./stroppy-config.json if present
stroppy run -f prod.json            # explicit config file
stroppy run -f prod.json tpcc/procs # config file with CLI script override
stroppy probe -f prod.json          # inspect effective config without running
```

The file is parsed as Stroppy's `RunConfig` JSON schema. Use camelCase field names such as `driverType`, `defaultInsertMethod`, `k6Args`, and `k6Config`. Unknown fields are rejected.

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Config file format version. Currently `"1"`. |
| `script` | string | Preset name, `.ts` path, `.sql` path, or inline SQL to run. |
| `sql` | string | Optional SQL file path or preset SQL name. If omitted, Stroppy auto-resolves SQL from the script and driver. |
| `global` | object | Global Stroppy settings: logger, OTLP exporter, run ID, seed, metadata. |
| `drivers` | object | Driver configs indexed by stringified slot number: `"0"`, `"1"`, etc. |
| `env` | object | Environment variables exposed to the k6 script. Keys are uppercased on load. |
| `steps` | string array | Step allowlist, equivalent to `--steps`. |
| `noSteps` | string array | Step blocklist, equivalent to `--no-steps`. |
| `k6Args` | string array | Raw arguments prepended to `k6 run`. CLI args after `--` are appended after these. |
| `k6Config` | string | Optional native k6 config JSON path. Stroppy prepends `--config <path>` to k6 args. |

## Precedence

When the same setting is supplied from multiple places, the higher-precedence source wins:

1. Real environment variables from the shell or container.
2. `-e KEY=VALUE` CLI environment overrides.
3. Config file `env` map.
4. `-d` and `-D` CLI driver presets and overrides.
5. Config file `drivers` map.
6. Script defaults from `declareDriverSetup()` and `export const options`.

Special cases:

| Setting | Resolution |
|---------|------------|
| `script` / `sql` | CLI positional arguments override config file `script` and `sql`. |
| `steps` / `noSteps` | CLI `--steps` or `--no-steps` override config file step lists. |
| `k6Args` | Config file `k6Args` come first; CLI args after `--` are appended, so CLI usually wins for repeated k6 flags. |
| `global` | Config-file only. There is no direct CLI equivalent for logger or OTLP exporter config. |

## PostgreSQL TPC-C Run

This example runs `tpcc/tx` against PostgreSQL with 10 warehouses, a 200-connection pool, and a 30-minute throughput run.

```json
{
  "version": "1",
  "script": "tpcc/tx",
  "global": {
    "runId": "tpcc-postgres-10w",
    "seed": "1",
    "metadata": {
      "environment": "staging",
      "owner": "db-team"
    },
    "logger": {
      "logLevel": "LOG_LEVEL_INFO"
    }
  },
  "drivers": {
    "0": {
      "driverType": "postgres",
      "url": "postgres://bench:bench@db:5432/tpcc",
      "defaultInsertMethod": "native",
      "pool": {
        "maxConns": 200,
        "minConns": 200
      }
    }
  },
  "env": {
    "WAREHOUSES": "10",
    "POOL_SIZE": "200",
    "LOAD_WORKERS": "8",
    "RETRY_ATTEMPTS": "3",
    "PACING": "false",
    "VUS": "64",
    "DURATION": "30m"
  }
}
```

Run it:

```bash
stroppy run -f stroppy-config.json
```

Override the duration without editing the file &mdash; real environment and `-e` take precedence over the config `env` map:

```bash
stroppy run -f stroppy-config.json -e DURATION=5m
```

Set concurrency and length with `VUS`/`DURATION`/`ITER`/`MAX_DURATION`, not the k6 `--vus`/`--duration` shortflags, which overwrite the workload's scenario block. See [Built-in Workloads](./presets#run-knobs-vus-duration-iterations).

## TPC-H Smoke Run

Use a small TPC-H scale factor and one iteration to verify schema, load, queries, and answer validation before a larger run.

```json
{
  "version": "1",
  "script": "tpch/tx",
  "drivers": {
    "0": {
      "driverType": "postgres",
      "url": "postgres://bench:bench@db:5432/tpch",
      "defaultInsertMethod": "native",
      "pool": {
        "maxConns": 50,
        "minConns": 10
      }
    }
  },
  "env": {
    "SCALE_FACTOR": "0.01",
    "LOAD_WORKERS": "8",
    "TPCH_QUERY_WARN_MS": "120000",
    "VUS": "1",
    "ITER": "1"
  }
}
```

Run it:

```bash
stroppy run -f tpch-smoke.json
```

## YDB With TLS And Token Auth

YDB commonly uses `grpcs://` with a CA certificate and token. TPC workloads usually use serializable isolation on YDB.

```json
{
  "version": "1",
  "script": "tpcc/tx",
  "drivers": {
    "0": {
      "driverType": "ydb",
      "url": "grpcs://ydb.example.net:2135/tenant/db",
      "defaultInsertMethod": "native",
      "defaultTxIsolation": "serializable",
      "pool": {
        "maxConns": 100,
        "minConns": 100
      },
      "caCertFile": "./certs/ca.pem",
      "authToken": "t1.example"
    }
  },
  "env": {
    "WAREHOUSES": "50",
    "POOL_SIZE": "100",
    "LOAD_WORKERS": "16",
    "PACING": "false"
  },
  "steps": ["drop_schema", "create_schema", "load_data", "create_indexes"]
}
```

This config intentionally stops after setup steps. Remove `steps` to run every phase, or override it after setup when you only want to execute the workload step:

```bash
stroppy run -f ydb-tpcc-load.json --steps workload
```

## CSV Data Export

Use the CSV driver to materialize generated rows without connecting to a database. This example exports TPC-B data into `/tmp/tpcb-csv` and skips the workload step.

```json
{
  "version": "1",
  "script": "tpcb/tx",
  "drivers": {
    "0": {
      "driverType": "csv",
      "url": "/tmp/tpcb-csv?separator=comma&header=true&merge=true&workload=tpcb",
      "defaultInsertMethod": "native"
    }
  },
  "env": {
    "SCALE_FACTOR": "10",
    "LOAD_WORKERS": "8"
  },
  "steps": ["drop_schema", "create_schema", "load_data"]
}
```

Run it:

```bash
stroppy run -f csv-export.json
```

## Validate Before Running

`stroppy probe` loads the config file, resolves the script, evaluates declared environment variables, and prints the effective driver config without connecting to the target database.

```bash
stroppy probe -f stroppy-config.json --config --envs --drivers --steps
```

Use debug logging when you need to see why a value was selected:

```bash
LOG_LEVEL=debug stroppy probe -f stroppy-config.json --envs --drivers
```

## Driver Fields

Config file driver entries accept the same user-facing fields as CLI raw JSON and TypeScript `DriverSetup` defaults, including:

| Field | Description |
|-------|-------------|
| `driverType` | `postgres`, `mysql`, `picodata`, `ydb`, `noop`, or `csv`. |
| `url` | Driver-specific connection URL or DSN. |
| `defaultInsertMethod` | `native`, `columnar`, `plain_bulk`, or `plain_query`. |
| `defaultTxIsolation` | `read_uncommitted`, `read_committed`, `repeatable_read`, `serializable`, `db_default`, `conn`, or `none`. |
| `errorMode` | `silent`, `log`, `throw`, `fail`, or `abort`. |
| `bulkSize` | Rows per bulk INSERT or native batch. |
| `pool` | Portable pool settings mapped by driver type. |
| `postgres` | PostgreSQL/Picodata-specific pool settings. Takes priority over `pool`. |
| `sql` | MySQL/YDB `database/sql` pool settings. Takes priority over `pool`. |
| `caCertFile` | CA certificate PEM path for TLS. |
| `authToken` | Token credential, mainly for YDB. |
| `authUser` / `authPassword` | Static credentials. |
| `tlsInsecureSkipVerify` | Disable TLS verification for testing. |

See [Drivers & Configuration](./drivers) for URL formats, presets, pool mappings, and per-driver behavior.
