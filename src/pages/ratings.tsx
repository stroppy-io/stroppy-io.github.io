import {useCallback, useEffect, useMemo, useState} from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {useHistory, useLocation} from '@docusaurus/router';
import compatJson from '@site/static/data/conformity/compat.json';
import errataJson from '@site/static/data/conformity/errata.json';
import type {Compat, Errata as ErrataFile} from '@site/src/components/conformity/types';
import {day, protocolShort, protocolsOf} from '@site/src/components/conformity/data';
import useRatings from '@site/src/components/landing/useRatings';
import {TopBoard} from '@site/src/components/landing/Leaderboard';
import {CLOUD, SCENARIOS} from '@site/src/components/landing/rating';
import {COMPATIBLE} from '@site/src/components/landing/CompatSpread';
import {Protocols, Tools, toolsInWords, type ProtocolCard} from '@site/src/components/ratings/Ask';
import FitTable, {type Fit, type Workload} from '@site/src/components/ratings/FitTable';
import Drawer from '@site/src/components/conformity/Drawer';
import EngineDetail from '@site/src/components/ratings/EngineDetail';
import {Families, StorageEngines} from '@site/src/components/ratings/Sections';
import Unpublished from '@site/src/components/conformity/Unpublished';
import Errata from '@site/src/components/conformity/Errata';
import {BANDS, bandOf, fitShare, originalTpcc, runsOf, subjectsOf, toolFit, toolsOf, type Band} from '@site/src/components/ratings/fit';
import {parse, serialize, type State, type View} from '@site/src/components/ratings/state';
import '../css/landing.css';
import '../css/ratings.css';

// Which database can replace the one your clients speak to, and what breaks.
// The reader picks the protocol (a card each, with what is known about it)
// and names their tools; every engine that claims the protocol answers,
// grouped by what it means for those tools, with its speed where Stroppy
// Cloud ran it. Beside the engines, as views of the same protocol: speed by
// where it ran, forks against what they forked, storage engines, what was not
// published, what we corrected. Data: the conformity export
// (static/data/conformity) and Stroppy Cloud's rating. Everything the reader
// picks lives in the query string (ratings/state.ts).

const compat = compatJson as unknown as Compat;
const errata = errataJson as unknown as ErrataFile;
const PROTOCOLS = protocolsOf(compat);

const unpublishedOf = (proto: string) => [...compat.not_measured, ...compat.withheld].filter((u) => u.protocol === proto);

const CARDS: ProtocolCard[] = PROTOCOLS.map((proto) => {
  const subjects = subjectsOf(compat, proto);
  return {
    proto,
    engines: subjects.length,
    compatible: subjects.filter((r) => (r.scores.overall ?? 0) >= COMPATIBLE).length,
    held: unpublishedOf(proto).length,
  };
});

/** The band an engine is in when no tool is picked: its own score. Crashes are counted in the row. */
function bandByScore(overall: number | null | undefined): Band {
  if (typeof overall !== 'number') return 'unknown';
  return overall >= COMPATIBLE ? 'same' : 'differs';
}

export default function RatingsPage() {
  const ratings = useRatings();
  const location = useLocation();
  const history = useHistory();
  // The URL is read after hydration, so the server's HTML and the first client render agree.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const st = parse(ready ? location.search : '', PROTOCOLS);
  const set = useCallback(
    (next: Partial<State>) => history.replace({search: serialize({...parse(window.location.search, PROTOCOLS), ...next}, PROTOCOLS)}),
    [history],
  );

  const original = protocolShort(st.proto);
  const tools = useMemo(() => toolsOf(compat, st.proto), [st.proto]);
  const picked = st.tools.filter((t) => tools.some((x) => x.name === t));
  const pickedTools = picked.map((name) => tools.find((t) => t.name === name)).filter((t) => t !== undefined);
  const base = originalTpcc(compat, st.proto, ratings);

  const fits: Fit[] = subjectsOf(compat, st.proto).map((row) => {
    const cells = pickedTools.map((t) => toolFit(compat.legend, row, t));
    const runs = runsOf(row, ratings);
    const tx = runs.find((r) => r.label === 'TPC-C')?.run;
    return {
      row,
      cells,
      runs,
      band: pickedTools.length ? bandOf(cells.map((c) => c.state)) : bandByScore(row.scores.overall),
      share: tx && base?.value && ratings.tx?.data.includes(tx) ? tx.value / base.value : undefined,
    };
  });
  // The table's own order: what the engine means for the reader (its band), then the closest to the original for
  // the reader's tools; the export's order (the score) breaks a tie.
  fits.sort((a, b) => BANDS.indexOf(a.band) - BANDS.indexOf(b.band) || (pickedTools.length ? fitShare(b.cells) - fitShare(a.cells) : 0));
  const count = (b: Band) => fits.filter((f) => f.band === b).length;
  const words = toolsInWords(picked);
  const q = st.q.trim().toLowerCase();
  const shown = q ? fits.filter((f) => f.row.target.toLowerCase().includes(q)) : fits;
  // The workloads some engine of the protocol ran, in the board's order, each with its unit and direction.
  const workloads: Workload[] = SCENARIOS.flatMap((s) => {
    const run = fits.flatMap((f) => f.runs).find((r) => r.label === s.label);
    return run ? [{label: s.label, unit: run.run.unit, higher: run.higher}] : [];
  });
  const opened = fits.find((f) => f.row.id === st.db);

  const families = compat.families.rows.filter((f) => f.protocol === st.proto);
  const storage = compat.access_methods.rows.filter((r) => r.protocol === st.proto && r.role === 'subject');
  const unpublished = unpublishedOf(st.proto);
  const corrections = errata.entries.filter((e) => e.protocol === st.proto);

  // A view per question about the protocol, shown only where it has data; each says what it answers.
  const views: {id: View; label: string; desc: string}[] = [
    {
      id: 'engines',
      label: 'Compatibility',
      desc: `Every engine that claims ${original}, checked against it: what works for your tools, how fast it ran.`,
    },
    {
      id: 'speed',
      label: 'Benchmarks',
      desc: 'TPC-C, TPC-H and TPC-DS runs, one table per workload, topology, hardware and scale. A row opens the report of its run.',
    },
    ...(families.length
      ? [{id: 'forks' as const, label: 'Forks', desc: 'A fork against the product it forked: of the checks both answered, how many alike.'}]
      : []),
    ...(storage.length
      ? [
          {
            id: 'storage' as const,
            label: 'Storage engines',
            desc: 'A storage engine or extension against the same build on its default storage: what it alone changes.',
          },
        ]
      : []),
    ...(unpublished.length
      ? [
          {
            id: 'held' as const,
            label: 'Held back',
            desc: 'Measured and not published, each with the reason. It says nothing about the engine.',
          },
        ]
      : []),
    ...(corrections.length
      ? [
          {
            id: 'errata' as const,
            label: 'Corrections',
            desc: `${original} results we published and then changed, and why.`,
          },
        ]
      : []),
  ];
  const view = views.some((v) => v.id === st.view) ? st.view : 'engines';
  const close = useCallback(() => set({db: null}), [set]);

  return (
    <Layout
      title="Replace a database without breaking your tools"
      description="Every engine that claims to speak PostgreSQL, MySQL, MongoDB, Elasticsearch, Redis or S3, checked against the original: what works for your tools, what breaks, and how fast.">
      <main className="rp">
        <h1 className="rp-title">Replace {original} without breaking your tools</h1>
        <Protocols
          cards={CARDS}
          value={st.proto}
          onPick={(p) => set({proto: p, tools: [], db: null, q: '', sort: null, view: 'engines'})}
        />

        <nav className="rp-views" aria-label={`About ${original}`}>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-current={v.id === view ? 'page' : undefined}
              className={clsx(v.id === view && 'is-on')}
              onClick={() => set({view: v.id})}>
              {v.label}
            </button>
          ))}
        </nav>
        <p className="rp-view-desc">{views.find((v) => v.id === view)?.desc}</p>

        {view === 'engines' && (
          <section aria-label={`Engines that claim ${original}`}>
            <Tools proto={st.proto} tools={tools} picked={picked} onTools={(t) => set({tools: t})} />
            <p className="rp-answer">
              {fits.length === 0 ? (
                <>No engine that claims {original} is published yet. What was measured, and why it is held back, is under Held back.</>
              ) : pickedTools.length ? (
                <>
                  <b>
                    {count('same')} of {fits.length}
                  </b>{' '}
                  run {words} the way {original} does; {count('differs')} answer some of it differently, {count('breaks')} break on it.
                </>
              ) : (
                <>
                  <b>
                    {count('same')} of {fits.length}
                  </b>{' '}
                  answer at least {COMPATIBLE}% of our checks the way {original} does. Pick your tools to see what works for them.
                </>
              )}
            </p>
            <p className="rp-meta">
              Each engine against the {original} version it reports, checked {day(compat.dataset.audited_at)}.{' '}
              <Link to="/tools/conformity">How the checks work</Link>
            </p>
            {fits.length > 0 && (
              <>
                <div className="rp-toolbar">
                  <input
                    type="search"
                    className="rp-search"
                    placeholder="Find an engine"
                    aria-label="Find an engine"
                    value={st.q}
                    onChange={(e) => set({q: e.target.value})}
                  />
                  <span className="rp-count">
                    {shown.length === fits.length ? `${fits.length} engines` : `Showing ${shown.length} of ${fits.length}`}
                  </span>
                </div>
                {shown.length > 0 ? (
                  <FitTable
                    original={original}
                    tools={picked}
                    workloads={workloads}
                    fits={shown}
                    sort={st.sort}
                    dir={st.dir}
                    onSort={(sort, dir) => set({sort, dir})}
                    open={st.db}
                    onOpen={(id) => set({db: id})}
                  />
                ) : (
                  <p className="rp-empty">
                    No engine matches “{st.q}”.{' '}
                    <button type="button" className="rp-link" onClick={() => set({q: ''})}>
                      Clear the search
                    </button>
                  </p>
                )}
              </>
            )}
            {opened && (
              <Drawer data={compat} row={opened.row} onClose={close}>
                <EngineDetail
                  row={opened.row}
                  legend={compat.legend}
                  original={original}
                  tools={tools}
                  picked={picked}
                  runs={opened.runs}
                  fork={compat.forks.rows.find((k) => k.row === opened.row.id)}
                  onTool={(name) => set({tools: picked.includes(name) ? picked.filter((t) => t !== name) : [...picked, name]})}
                />
              </Drawer>
            )}
          </section>
        )}

        {view === 'speed' && (
          <section className="rp-view" aria-label="Speed, by where it ran">
            <TopBoard more={{href: `${CLOUD}/leaderboard`, label: 'Stroppy Cloud leaderboard'}} />
          </section>
        )}

        {view === 'forks' && (
          <section className="rp-view" aria-label="Forks against the product they forked">
            <Families rows={families} />
          </section>
        )}

        {view === 'storage' && (
          <section className="rp-view" aria-label="Storage engines and extensions">
            <StorageEngines rows={storage} />
          </section>
        )}

        {view === 'held' && (
          <section className="rp-view" aria-label="Measured, not published yet">
            <Unpublished rows={unpublished} />
          </section>
        )}

        {view === 'errata' && (
          <section className="rp-view" aria-label="What we corrected">
            <p className="rp-meta">
              Found an error? <Link to="/vendors#dispute">Report it</Link>
            </p>
            <Errata entries={corrections} />
          </section>
        )}
      </main>
    </Layout>
  );
}
