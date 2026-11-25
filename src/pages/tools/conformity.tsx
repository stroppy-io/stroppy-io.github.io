import ToolPage from '@site/src/components/tools/ToolPage';
import {DOCS, REPOS} from '@site/src/components/tools/tools';
import Explorer from '@site/src/components/conformity/Explorer';
import compatJson from '@site/static/data/conformity/compat.json';
import type {Compat, Row} from '@site/src/components/conformity/types';
import {protocolName, protocolsOf} from '@site/src/components/conformity/data';

// Stroppy Conformity: facts and examples from its README and docs
// (stroppy-io/stroppy-conformity: methodology, measure-your-build, agents),
// and from the published dataset: the map (conformity/Explorer.tsx) first,
// the protocols and the originals' versions it covers, and the provenance of
// its best PostgreSQL engine.

const compat = compatJson as unknown as Compat;
const PROTOCOLS = protocolsOf(compat);

/** "9.4" from "9.4.26", "18.6" from "18.6 (Debian 18.6-1.pgdg13+2)": what a reference reports, short. */
const short = (claims: string) => /^\d+(\.\d+)?/.exec(claims)?.[0] ?? claims;

/** The original's versions a protocol is checked against, lowest to highest. */
function versions(protocol: string): string {
  const v = [...new Set(compat.rows.filter((r) => r.protocol === protocol && r.role === 'reference').map((r) => short(r.claims)))].sort(
    (a, b) => a.localeCompare(b, undefined, {numeric: true}),
  );
  return v.length > 1 ? `${v[0]} to ${v[v.length - 1]}` : (v[0] ?? '');
}

const NUMBERS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/** The provenance a row carries, as compat.json has it: the best-scoring PostgreSQL engine. */
const example: Row | undefined = compat.rows
  .filter((r) => r.protocol === 'pgwire' && r.role === 'subject')
  .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))[0];

export default function ConformityToolPage() {
  return (
    <ToolPage
      tool="conformity"
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
          lead: `${NUMBERS[PROTOCOLS.length - 1] ?? PROTOCOLS.length} protocols, each against its own releases, at every layer a client touches: connection and authentication, query flows, errors and cancel, the type contract, bulk load, replication, the catalog queries clients send, and the originals’ own test suites.`,
          example: (
            <ul className="tl-list">
              {PROTOCOLS.map((p) => (
                <li key={p}>
                  <b>{protocolName(p)}</b>
                  <span>{versions(p)}</span>
                </li>
              ))}
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
          code: example && {
            language: 'json',
            title: `compat.json, dataset ${compat.dataset.id}`,
            text: JSON.stringify(
              {
                id: example.id,
                claims: example.claims,
                baseline: {reference: example.baseline.reference},
                image_digest: example.image_digest,
                measured_at: example.measured_at,
              },
              null,
              2,
            ),
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
