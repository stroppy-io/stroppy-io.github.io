import Link from '@docusaurus/Link';
import type {Group} from './Charts';

// How fast the client is: published measurements only, each group naming its
// post, plotted on the Stroppy tool page (/tools/stroppy#baseline).

export const CLIENT_SPEED: Group[] = [
  {
    title: 'go-tpc → Stroppy',
    per: 'go-tpc',
    setting: (
      <>
        TPC-C on OrioleDB, one hour, 1000 warehouses, 100 VUs, Stroppy 5.7.2. <Link to="/blog/stroppy-vs-go-tpc">How we found it</Link>
      </>
    ),
    rows: [{label: 'go-tpc → tpcc/procs', them: 6399, us: 15791}],
  },
  {
    title: 'v5 on k6 → v6',
    per: 'v5',
    setting: (
      <>
        Medians of five runs on one AMD EPYC Genoa VM. Big on the noop driver, small on a real database, which is how it should be.{' '}
        <Link to="/blog/why-stroppy-moved-off-k6">Why we dropped k6</Link>
      </>
    ),
    rows: [
      {label: 'TPC-B ceiling, 1 VU', them: 4368, us: 145524},
      {label: 'TPC-B ceiling, 24 VUs', them: 38694, us: 517627},
      {label: 'TPC-C on PostgreSQL, 1 VU', them: 202, us: 290},
      {label: 'TPC-C on PostgreSQL, 16 VUs', them: 2892, us: 3368},
    ],
  },
  {
    title: 'Database → Stroppy ceiling',
    per: 'PostgreSQL',
    setting: 'Same VM, 16 VUs. Different workloads; the gap is the room the client leaves.',
    rows: [{label: 'PostgreSQL TPC-C → noop TPC-B', them: 3368, us: 500772}],
  },
];
