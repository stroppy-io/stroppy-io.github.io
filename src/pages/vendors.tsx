import SectionPage from '@site/src/components/tools/SectionPage';
import {mapUrl} from '@site/src/components/conformity/data';
import {DISCORD} from '@site/src/components/nav/menu';
import {ADD_DATABASE, CORRECTIONS, REPORT_ERROR, issueUrl, type IssueForm} from '@site/src/components/vendors/vendors';

// For database vendors: how to get measured, how the measurement stays fair,
// how to reproduce and contest a result, and every correction made. Requests
// are issues in Stroppy's public repository (src/components/vendors/vendors.ts).

/** What the issue asks for, field by field. */
function Fields({form}: {form: IssueForm}) {
  return (
    <ul className="tl-list">
      {form.fields.map((f) => (
        <li key={f.name}>
          <b>{f.name}</b>
          <span>{f.hint}</span>
        </li>
      ))}
    </ul>
  );
}

function Corrections() {
  return (
    <ol className="tl-list">
      {CORRECTIONS.map((c) => (
        <li key={`${c.date}-${c.result}`}>
          <b>
            {c.date} · {c.result}
          </b>
          <span>
            {c.change} <a href={c.issue}>Issue ↗</a>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function VendorsPage() {
  return (
    <SectionPage
      accent="vendors"
      title="Vendors"
      eyebrow="For database vendors"
      tagline="Get your database measured on the same terms as every other engine, and tell us when a result is wrong."
      intro={
        <p>
          We publish speed and protocol compatibility for every engine we can run. Adding yours and contesting a result both go through
          public issues, so anyone can follow what was asked and what changed.
        </p>
      }
      actions={[
        {label: 'Add your database', href: issueUrl(ADD_DATABASE)},
        {label: 'Report an error', href: issueUrl(REPORT_ERROR)},
      ]}
      facts={['Same tests for every engine', 'Every number opens its source', 'Corrections published with dates']}
      sections={[
        {
          id: 'add',
          title: 'Add your database',
          lead: 'Open an issue in Stroppy’s repository with what we need to run your database the way we run the others. The form comes filled in.',
          example: <Fields form={ADD_DATABASE} />,
          links: [{label: 'Open the issue', href: issueUrl(ADD_DATABASE)}],
        },
        {
          id: 'preview',
          title: 'Run the tests on your build',
          lead: 'The workload behind the rating and the compatibility checks are open source and need no account. Run them on a branch or a nightly before a release.',
          points: [
            <>
              Speed: <code>tpcc/tx</code>, the rating’s workload, against your endpoint.
            </>,
            'Compatibility: your endpoint in a small YAML file, checked against the original it claims.',
          ],
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              '# speed',
              'stroppy run tpcc/tx -d pg \\',
              '  -D url=postgres://user:password@host:5432/db',
              '',
              '# compatibility, endpoint in mine/my-engine.yaml',
              'bin/conformity golden -t postgres-18',
              'bin/conformity run -t my-engine',
            ].join('\n'),
          },
          links: [
            {label: 'Stroppy', href: '/tools/stroppy#install'},
            {label: 'Measure your build', href: '/tools/conformity#your-build'},
          ],
        },
        {
          id: 'fairness',
          title: 'How we keep it fair',
          lead: 'Every engine gets the same tests, and every result says exactly what was measured.',
          points: [
            'Speed: the same TPC-C on one 32 vCPU · 128 GB node; each engine deployed the same way and tuned for that machine.',
            'The rating compares runs of one workload on one machine class only.',
            'Compatibility: an engine is checked against the original it claims; the expected answers come from the original, never written by hand.',
            'A crash counts only when the server is seen to go down or restart.',
            'Every result records the image it ran and when it was measured.',
          ],
          links: [
            {label: 'Why the numbers hold up', href: '/tools/conformity#evidence'},
            {label: 'Tuning', href: '/how#tuning'},
          ],
        },
        {
          id: 'reproduce',
          title: 'Reproduce a result',
          lead: 'Every number opens its source, by a link you can quote.',
          example: (
            <ul className="tl-list">
              <li>
                <b>A rating row</b>
                <span>opens the run’s report in Stroppy Cloud: throughput, latency, errors</span>
              </li>
              <li>
                <b>A compatibility cell</b>
                <span>opens its checks: what was sent, what the original answered, what the engine answered</span>
              </li>
            </ul>
          ),
          links: [
            {label: 'Ratings', href: '/ratings'},
            {label: 'Conformity map', href: mapUrl()},
          ],
        },
        {
          id: 'dispute',
          title: 'Report an error',
          lead: 'Think a result is wrong? Open an issue with the result, what is wrong and how to see it. We rerun it; if we were wrong, the result changes and the correction is listed below.',
          example: <Fields form={REPORT_ERROR} />,
          links: [{label: 'Open the issue', href: issueUrl(REPORT_ERROR)}],
        },
        {
          id: 'corrections',
          title: 'Corrections',
          lead:
            CORRECTIONS.length === 0
              ? 'None yet. Each correction will be listed here with its date, what changed and why.'
              : 'Every published result we changed, newest first.',
          example: CORRECTIONS.length > 0 && <Corrections />,
        },
        {
          id: 'contact',
          title: 'Talk to us',
          lead: 'Questions and partnerships: find us on Discord.',
          links: [{label: 'Discord', href: DISCORD}],
        },
      ]}
    />
  );
}
