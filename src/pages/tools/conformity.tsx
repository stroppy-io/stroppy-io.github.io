import ToolPage from '@site/src/components/tools/ToolPage';
import {DOCS, REPOS} from '@site/src/components/tools/tools';
import Explorer from '@site/src/components/conformity/Explorer';

// Stroppy Conformity: facts and examples from its README and docs
// (stroppy-io/stroppy-conformity: methodology, measure-your-build, agents),
// the provenance example from the published dataset's cockroachdb row, and the
// dataset itself as the map (conformity/Explorer.tsx), first.

export default function ConformityToolPage() {
  return (
    <ToolPage
      tool="conformity"
      eyebrow="Protocol conformity · open source"
      tagline="Does this database really speak PostgreSQL? MySQL? MongoDB? Elasticsearch? Redis? Measured, not claimed."
      intro={
        <p>
          It runs the same scripted interactions against the real engine and against the engine that claims to be compatible, and compares
          what each does on the wire. Every verdict carries its evidence: what was sent, what the original answered, what the engine
          answered, and the frame trace.
        </p>
      }
      actions={[
        {label: 'See the results', href: '#results'},
        {label: 'GitHub', href: REPOS.conformity},
        {label: 'Methodology', href: DOCS.conformityDoc('methodology.md')},
      ]}
      facts={['Five protocols', 'Expected values from the real engine', 'No account needed', 'Apache-2.0']}
      sections={[
        {
          id: 'results',
          title: 'Results',
          lead: 'The audited dataset: every engine against the original it claims, check by check. Pick an engine for what differs; the ratings put it next to TPC-C speed.',
          media: <Explorer />,
          links: [{label: 'Ratings', href: '/ratings'}],
        },
        {
          id: 'coverage',
          title: 'What it covers',
          lead: 'Five protocols, each against its own releases, at every layer a client touches: connection and authentication, query flows, errors and cancel, the type contract, bulk load, replication, the catalog queries clients send, and the originals’ own test suites.',
          example: (
            <ul className="tl-list">
              <li>
                <b>PostgreSQL wire</b>
                <span>13 to 18</span>
              </li>
              <li>
                <b>MySQL wire</b>
                <span>5.7 to 9</span>
              </li>
              <li>
                <b>MongoDB wire</b>
                <span>6.0 to 8.0</span>
              </li>
              <li>
                <b>Elasticsearch REST</b>
                <span>7 to 9</span>
              </li>
              <li>
                <b>Redis</b>
                <span>7.2 and 8.2, RESP2 and RESP3</span>
              </li>
            </ul>
          ),
          links: [{label: 'Every engine and its image', href: DOCS.conformityDoc('targets.md')}],
        },
        {
          id: 'evidence',
          title: 'Why the numbers hold up',
          lead: 'A refusal is loud; a different answer is quiet, because the client gets it without an error. The report keeps the two apart, and every row says exactly what was measured.',
          points: [
            'Expected values come from the real engine, never written by hand; each original is also run against its own recording.',
            'A crash is charged only when the server is seen to go down or restart.',
            'Catalog queries come from the clients themselves: pgx, pgjdbc, psql, pg_dump, the mysql CLI, mongosh, Kibana and others.',
          ],
          code: {
            language: 'json',
            title: 'compat.json, dataset 45a7361f915b',
            text: [
              '{',
              '  "id": "cockroachdb-pgwire",',
              '  "claims": "18.0.0",',
              '  "baseline": {"reference": "postgres-18"},',
              '  "image_digest": "cockroachdb/cockroach@sha256:c26ade77…",',
              '  "measured_at": "2026-10-23T13:09:30Z"',
              '}',
            ].join('\n'),
          },
          links: [
            {label: 'Methodology', href: DOCS.conformityDoc('methodology.md')},
            {label: 'Contest a finding', href: `${DOCS.conformityDoc('methodology.md')}#10-how-to-contest-a-finding`},
          ],
        },
        {
          id: 'try',
          title: 'Try it',
          lead: 'Go 1.27 and Docker with compose v2. Bring up an original and an engine, record what the original answers, run the engine against it, then open out/site/report.html.',
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              'make build',
              'bin/conformity targets up postgres-18 cockroachdb',
              'bin/conformity golden -t postgres-18',
              'bin/conformity run -t cockroachdb',
              'bin/conformity reports export --format site,html -o out/site',
              'bin/conformity targets down postgres-18 cockroachdb',
            ].join('\n'),
          },
          links: [{label: 'README', href: DOCS.conformity}],
        },
        {
          id: 'your-build',
          title: 'Measure your build',
          lead: 'A branch, a nightly or a server with a compatibility switch: describe the endpoint in a small YAML file and run against it. Without a compose file the tool only connects; it never starts or stops anything. Nothing needs an account or a cloud service.',
          code: {
            language: 'yaml',
            title: 'mine/my-engine.yaml',
            text: [
              'name: my-engine',
              'engine: my-engine',
              'version: "branch-x"',
              'role: subject',
              'endpoints:',
              '  - protocol: pgwire    # or mysql, mongo, elastic',
              '    host: 10.0.0.5',
              '    port: 5432',
              '    user: conformity',
              '    password: secret',
              '    database: conformity',
            ].join('\n'),
          },
          links: [{label: 'Measure your build', href: DOCS.conformityDoc('measure-your-build.md')}],
        },
        {
          id: 'agents',
          title: 'For agents',
          lead: 'conformity compare answers a migration question from the measured data: what is lost going from one engine to another, concept by concept, with the checks behind it. An MCP server gives an agent the same answers, and says “not measured” where there is none.',
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              'conformity compare --from postgres-17 --to cockroachdb \\',
              '  --concept "Bulk load" --format json',
              '',
              'conformity mcp --dataset /path/to/export',
            ].join('\n'),
          },
          links: [{label: 'For agents', href: DOCS.conformityDoc('agents.md')}],
        },
      ]}
    />
  );
}
