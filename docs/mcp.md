---
sidebar_position: 10
title: MCP Server
description: Using Stroppy through Claude Code and other AI assistants via the Model Context Protocol
---

# MCP Server

Stroppy ships with an MCP (Model Context Protocol) server that gives AI assistants direct access to database stress testing. Instead of the assistant constructing shell commands, parsing stdout, and re-approving every invocation, it calls structured tools that return structured results.

```
AI assistant  →  stroppy-mcp (stdio)  →  stroppy CLI  →  PostgreSQL
```

The MCP server is a separate Go binary called `stroppy-mcp`. It wraps the `stroppy` CLI and exposes its capabilities as MCP tools.

## Why not just use bash?

An AI assistant *can* drive Stroppy through shell commands. But three things make that painful in practice:

**Permission prompts.** Every unique bash command needs user approval. A benchmark session with varying VUs, durations, and report paths produces a different command string each time &mdash; and each one interrupts the user. MCP tools are approved once via configuration; parameters don't affect permissions.

**Output parsing.** Stroppy (k6) writes metrics to stdout mixed with progress bars, warnings, and log lines. The assistant has to grep for p95 values. MCP returns structured data &mdash; the assistant gets latency percentiles, throughput, and error rates as fields it can reason about directly.

**Multi-step workflows.** "Inspect the config, run a baseline, suggest tuning, re-run, compare" is 5+ tool calls. With bash, each call is a new command to construct and approve. With MCP, each call is a typed invocation with named parameters.

## Setup

### 1. Get the stroppy-mcp binary

**Download a release:**

```bash
curl -L https://github.com/stroppy-io/stroppy-mcp/releases/latest/download/stroppy-mcp_linux_amd64.tar.gz | tar xz
sudo mv stroppy-mcp /usr/local/bin/
```

**Or build from source** (requires Go 1.24+):

```bash
git clone https://github.com/stroppy-io/stroppy-mcp.git
cd stroppy-mcp && go build -o stroppy-mcp .
```

### 2. Configure Claude Code

Add the MCP server to your project's `.mcp.json` (or `~/.claude/settings.json` for global access):

```json
{
  "mcpServers": {
    "stroppy": {
      "command": "/usr/local/bin/stroppy-mcp",
      "env": {
        "STROPPY_BIN": "/usr/local/bin/stroppy"
      }
    }
  }
}
```

Setting `STROPPY_BIN` explicitly removes any ambiguity about which binary gets called. Without it, the server searches `./build/stroppy` and then `$PATH`.

### 3. Allow tool permissions

By default, Claude Code prompts for approval on every MCP tool call. To allow all Stroppy tools globally, add this to `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__stroppy__*"
    ]
  }
}
```

This wildcards every tool from the `stroppy` server &mdash; no more per-directory prompts.

### 4. Verify

Start Claude Code in a directory with `.mcp.json`. The Stroppy tools should appear in the tool list. Try asking:

> inspect my database at postgres://postgres:postgres@localhost:5432?sslmode=disable

If `inspect_db` returns version info and tuning parameters, everything is wired up.

## Tools

| Tool | Parameters | What it does |
|------|-----------|--------------|
| `stroppy_gen` | `preset`, `workdir` | Scaffold a workspace from a preset (simple, tpcb, tpcc, tpcds, execute_sql) |
| `stroppy_run` | `script`, `sql_file`, `env`, `duration`, `driver_url`, `report_path` | Execute a stress test. Returns k6 metrics summary. |
| `stroppy_validate` | `script`, `sql_file` | Dry-run transpile check &mdash; catches errors before a real run |
| `inspect_db` | `url` | Connect to PostgreSQL, return version, tuning parameters, and database size |
| `read_k6_summary` | `path` | Parse a k6 JSON summary file into formatted metrics |
| `list_presets` | &mdash; | List available workload presets with descriptions |
| `read_file` | `path` | Read a project file (.ts, .sql, .yaml, .json, etc.), capped at 100KB |

### stroppy_run in detail

This is the primary tool. Its parameters map to environment variables that the test scripts read:

| Parameter | Env var | Default | Description |
|-----------|---------|---------|-------------|
| `script` | &mdash; | *(required)* | Path to the .ts test script |
| `sql_file` | &mdash; | &mdash; | Path to .sql file (required for some workloads) |
| `env` | *(varies)* | &mdash; | Script-specific env vars as `KEY=VALUE` pairs, e.g. `VUS_SCALE=5 WAREHOUSES=10` |
| `duration` | `DURATION` | Script default | Test duration (e.g. `30s`, `5m`) |
| `driver_url` | `STROPPY_DRIVER_0` | Script default | Database connection URL (passed as driver config) |
| `report_path` | `K6_WEB_DASHBOARD_EXPORT` | &mdash; | Path to save an HTML report |

When `report_path` is set, the server automatically enables `K6_WEB_DASHBOARD=true`.

Each test script defines its own parameters via the `ENV()` helper. Built-in presets:

- **TPC-B**: `SCALE_FACTOR` (default 1), uses k6 `--vus` and `--duration` flags directly
- **TPC-C**: `VUS_SCALE` &mdash; multiplier across all 5 scenarios, `1` = 99 VUs, `0.5` &asymp; 50, `0.1` &asymp; 11 (default 1). `DURATION` (default `"1h"`), `POOL_SIZE` (default 100), `SCALE_FACTOR`/`WAREHOUSES` (default 1)

For unfamiliar scripts, read the source first to discover its env var knobs.

## Resource

The server exposes Stroppy's full documentation as an MCP resource:

| URI | Description |
|-----|-------------|
| `stroppy://docs` | Complete Stroppy documentation (embedded at build time) |

This lets the assistant read the docs on demand without you pasting them into the conversation.

## Cleanroom Docker Image

For a zero-setup demo environment, the project includes a Docker image with everything pre-installed: PostgreSQL, Stroppy, stroppy-mcp, and Claude Code.

```bash
# Build the image (from the stroppy-mcp repo)
cd cleanroom && bash build.sh

# Run it
docker run -it stroppy-cleanroom

# Or persist HTML reports on your host
docker run -it -v $(pwd)/reports:/workspace/reports stroppy-cleanroom
```

Inside the container, PostgreSQL is already running and the workspace is pre-scaffolded with TPC-B and TPC-C workloads. Just run `claude` and start asking questions.

:::note
PostgreSQL is bundled in the cleanroom image for demo convenience. In a real setup, you'd point `driver_url` at an external database.
:::

## Example: parameter sweep that found a 14x bottleneck

This is from a real session. The task: sweep TPC-C parameters to find every combination that exceeds 15,000 TPS. PostgreSQL 16 on a 16-core / 64GB machine, tuned config.

The assistant started by calling `inspect_db` (confirmed config: `shared_buffers=16GB`, `max_connections=400`), then `stroppy_gen` with the `tpcc` preset, then `read_file` on the generated script to discover its knobs. Three tool calls, no setup friction.

Then it ran 13 benchmarks sequentially, varying `VUS_SCALE`, `WAREHOUSES`, and `POOL_SIZE`. No permission prompts between runs. Selected results:

| VUS_SCALE | VUs | Pool | Warehouses | TPS |
|---|---|---|---|---|
| 0.5 | 50 | 100 | 1 | 10,138 |
| 1 | 99 | 100 | 1 | 17,960 |
| 2 | 198 | 100 | 1 | **1,346** |
| 2 | 198 | 200 | 1 | **19,751** |
| 3 | 297 | 300 | 1 | 22,728 |
| 4 | 396 | 400 | 1 | 24,034 |

Row 3 is the interesting one. 198 VUs with a 100-connection pool: TPS collapsed to 1,346 &mdash; a **14.7x drop**. The user spotted that the generated script hardcoded `sharedConnections: 100` in the driver config. The assistant read the script, added a `POOL_SIZE` env var, and re-ran. TPS jumped to 19,751. Same session, no context switch.

The assistant also noticed the generated script had VU counts hardcoded (44/43/4/4/4 across the 5 TPC-C scenarios). It added `VUS_SCALE` support by wrapping them in `Math.round(N * VUS_SCALE)`, then immediately used it for the rest of the sweep.

This is what MCP enables that bash doesn't: not just running benchmarks, but an uninterrupted loop where the assistant runs a test, reads the results, diagnoses a problem, edits the script, and re-runs &mdash; all in one conversation. The tool calls and the code edits aren't separate workflows. They're one workflow that MCP makes frictionless enough to actually happen.
