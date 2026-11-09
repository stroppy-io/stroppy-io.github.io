import ToolPage from '@site/src/components/tools/ToolPage';
import {CLOUD} from '@site/src/components/landing/rating';
import {TopBoard} from '@site/src/components/landing/Leaderboard';
import '@site/src/css/landing.css';

// Stroppy Cloud: facts from stroppy-cloud (database parameter schemas in
// pipelines/schemas/dbparams, provider kinds, the launch endpoint and webhook
// events in openapi/parts). The walk through a run is /how; its chapters are
// linked by id.

export default function CloudPage() {
  return (
    <ToolPage
      tool="cloud"
      tagline="Pick a database and a workload. Stroppy Cloud brings up the machines, tunes the engine, runs the load and hands you a report."
      intro={
        <p>
          The machines come up in your own cloud account and go away when the run ends; the report stays. Compare runs, put them on a
          schedule, publish them to the rating, or launch them from your CI.
        </p>
      }
      actions={[
        {label: 'Create an account', href: `${CLOUD}/register`},
        {label: 'How it works', href: '/how'},
        {label: 'See the ratings', href: '/ratings'},
      ]}
      sections={[
        {
          id: 'databases',
          title: 'Databases',
          lead: 'Each engine is deployed the same way and tuned for the machine it gets, so runs compare engines, not set-ups. Or point a test at a database you already run.',
          example: (
            <ul className="tl-list">
              <li>
                <b>PostgreSQL</b>
                <span>and OrioleDB</span>
              </li>
              <li>
                <b>MySQL</b>
                <span>and MariaDB</span>
              </li>
              <li>
                <b>Picodata</b>
                <span>distributed, PostgreSQL protocol</span>
              </li>
              <li>
                <b>YDB</b>
                <span>deployed for the run, or a managed one</span>
              </li>
              <li>
                <b>CockroachDB</b>
                <span>distributed, PostgreSQL protocol</span>
              </li>
              <li>
                <b>External</b>
                <span>your own database, by its address</span>
              </li>
            </ul>
          ),
          links: [{label: 'Tuning, in the walk-through', href: '/how#tuning'}],
        },
        {
          id: 'run',
          title: 'A run',
          lead: 'Connect a provider once. A run brings up its stand in your account, deploys and tunes the database, runs Stroppy while you watch, keeps the report and tears the stand down; it can keep the stand for a while to look into a failure.',
          example: (
            <ol className="tl-list">
              <li>
                <b>Stand</b>
                <span>machines in Yandex Cloud or AWS</span>
              </li>
              <li>
                <b>Database</b>
                <span>deployed and tuned for the machine</span>
              </li>
              <li>
                <b>Load</b>
                <span>TPC-C, as transactions or with procedures; TPC-B, TPC-H, TPC-DS</span>
              </li>
              <li>
                <b>Report</b>
                <span>throughput, latency, errors, a chart per segment</span>
              </li>
              <li>
                <b>Teardown</b>
                <span>the machines go, the report stays</span>
              </li>
            </ol>
          ),
          links: [
            {label: 'The run, in the walk-through', href: '/how#stand'},
            {label: 'Stroppy', href: '/tools/stroppy'},
          ],
        },
        {
          id: 'share',
          title: 'Compare, schedule, share',
          lead: 'One run answers one question. A suite runs variants of a test to compare them; a schedule runs a test on cron to catch regressions. A report opens by a public link, and runs sent to the public rating land here:',
          example: <TopBoard more={{href: '/ratings', label: 'All ratings →'}} />,
          links: [
            {label: 'Suites, in the walk-through', href: '/how#suites'},
            {label: 'Sharing, in the walk-through', href: '/how#share'},
          ],
        },
        {
          id: 'api',
          title: 'API and CI',
          lead: 'Everything the console does goes through a public REST API with an OpenAPI contract. A personal token launches a test from your pipeline; webhooks report each step of the run.',
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              'curl -X POST \\',
              "  'https://cloud.stroppy.io/api/v1/t/{tenant}/tests/{id}:launch' \\",
              '  -H "Authorization: Bearer $STROPPY_TOKEN"',
              '',
              '# webhook events',
              '# run.started  run.stage  run.finished',
              '# run.failed  run.cancelled',
              '# suite.started  suite.cell_finished  suite.finished',
            ].join('\n'),
          },
          links: [{label: 'From your pipeline, in the walk-through', href: '/how#api'}],
        },
      ]}
    />
  );
}
