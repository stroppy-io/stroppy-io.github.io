import ToolPage from '@site/src/components/tools/ToolPage';
import {REPOS} from '@site/src/components/tools/tools';
import {PairsPlot} from '@site/src/components/landing/Charts';
import {CLIENT_SPEED} from '@site/src/components/landing/evidence';
import '@site/src/css/landing.css';

// Stroppy, the CLI: facts and commands from its README and the released
// manual (/docs: introduction, presets, drivers, run-reports, custom-workloads,
// baseline).

export default function StroppyPage() {
  return (
    <ToolPage
      tool="stroppy"
      tagline="A database stress-testing CLI: one self-contained Go binary, no runtime to install."
      intro={
        <p>
          Point it at a database and run TPC-B, TPC-C, TPC-H or TPC-DS, or your own SQL. It loads the data, runs the load and hands back one
          JSON report with every step timed. The same binary runs on a laptop, in CI and inside Stroppy Cloud.
        </p>
      }
      actions={[
        {label: 'Install', href: '#install'},
        {label: 'Read the manual', href: '/docs/introduction'},
        {label: 'GitHub', href: REPOS.stroppy},
      ]}
      sections={[
        {
          id: 'install',
          title: 'Install and run',
          lead: 'A pre-built binary from GitHub Releases, the Docker image, or a build from source with Go 1.24.3 or newer. The first argument picks a built-in workload; -d picks the driver and -D overrides its options.',
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              'docker pull ghcr.io/stroppy-io/stroppy:latest',
              '',
              'stroppy run tpcc/tx -d pg \\',
              '  -D url=postgres://user:password@host:5432/dbname',
            ].join('\n'),
          },
          links: [
            {label: 'Releases', href: `${REPOS.stroppy}/releases`},
            {label: 'Getting started', href: '/docs/introduction'},
          ],
        },
        {
          id: 'workloads',
          title: 'Workloads',
          lead: 'The TPC suites are built in; a .sql file or an inline query runs the same way.',
          points: [
            <>
              <code>tpcc/tx</code> and <code>tpcb/tx</code>: raw transactions, every SQL driver.
            </>,
            <>
              <code>tpcc/procs</code> and <code>tpcb/procs</code>: stored procedures, PostgreSQL and MySQL; one round trip per transaction.
            </>,
            <>
              <code>tpch/tx</code>: eight tables and the 22 queries; <code>tpcds</code>: 24 tables from a faithful dsdgen port and the 99
              queries.
            </>,
          ],
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              'stroppy run tpcc/tx --executor constant-vus \\',
              '  --vus 10 --duration 60s',
              'stroppy run tpcc/tx --scale-factor 10 --load-workers 8',
              'stroppy run tpcds --scale-factor 1',
              'stroppy run queries.sql',
              'stroppy run "select 1"',
            ].join('\n'),
          },
          links: [
            {label: 'Presets and parameters', href: '/docs/presets'},
            {label: 'TPC-C in detail', href: '/docs/tests/tpcc'},
          ],
        },
        {
          id: 'drivers',
          title: 'Drivers and config',
          lead: 'PostgreSQL, MySQL, YDB and Picodata, plus CSV and noop. Settings you repeat go into stroppy-config.json: typed run parameters under run, workload parameters under params. A flag beats the environment, which beats the file.',
          code: {
            language: 'json',
            title: 'stroppy-config.json',
            text: [
              '{',
              '  "version": "1",',
              '  "script": "tpcc/tx",',
              '  "run": {',
              '    "executor": "constant-vus",',
              '    "vus": 10,',
              '    "duration": "60s"',
              '  },',
              '  "params": {"scaleFactor": 10, "loadWorkers": 8}',
              '}',
            ].join('\n'),
          },
          links: [
            {label: 'Drivers, pools and TLS', href: '/docs/drivers'},
            {label: 'Config file', href: '/docs/config-file'},
            {label: 'Transactions and retries', href: '/docs/transactions'},
          ],
        },
        {
          id: 'reports',
          title: 'Reports and metrics',
          lead: 'Every run can write one versioned JSON report: effective inputs, host, steps, metrics, bounded errors and workload results. Live metrics go out over OTLP.',
          points: [
            <>
              <code>tps</code> counts successful logical transactions; a retry that succeeds counts once.
            </>,
            'Human output and diagnostics stay on stderr, so stdout stays valid JSON.',
          ],
          code: {
            language: 'bash',
            title: 'Terminal',
            text: ['stroppy run tpcb/tx -d pg --report-format json', 'stroppy run tpcc/tx -d pg --report-file result.json'].join('\n'),
          },
          links: [
            {label: 'Run reports', href: '/docs/run-reports'},
            {label: 'Benchmarking workflow', href: '/docs/reports-workflow'},
          ],
        },
        {
          id: 'custom',
          title: 'Your own workload',
          lead: 'stroppy init lays out a Go workload against the authoring API; go test runs it without a database; stroppy run takes it like a built-in, with its own flags.',
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              'stroppy init select1',
              'go test ./...',
              'stroppy run select1 \\',
              "  -D url='postgres://user@localhost:5432/postgres' \\",
              '  --iterations 5',
              'stroppy run select1 --help',
            ].join('\n'),
          },
          links: [
            {label: 'Custom workloads', href: '/docs/custom-workloads'},
            {label: 'Extension points', href: '/docs/extensibility'},
          ],
        },
        {
          id: 'baseline',
          title: 'Client overhead',
          lead: 'stroppy baseline measures how fast Stroppy itself goes on this machine, against the noop driver and a server that only speaks the wire, so a result is never the client’s ceiling. What that ceiling looks like against other clients:',
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              'stroppy baseline --quick',
              'stroppy baseline --tiers noop,wire',
              'stroppy baseline --quick --json > baseline.json',
            ].join('\n'),
          },
          media: <PairsPlot groups={CLIENT_SPEED} />,
          links: [{label: 'Baseline', href: '/docs/baseline'}],
        },
      ]}
    />
  );
}
