import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {useHistory, useLocation} from '@docusaurus/router';
import compatJson from '@site/static/data/conformity/compat.json';
import errataJson from '@site/static/data/conformity/errata.json';
import type {Compat, Errata as ErrataFile} from '@site/src/components/conformity/types';
import {day, protocolShort, protocolsOf} from '@site/src/components/conformity/data';
import useRatings from '@site/src/components/landing/useRatings';
import {SCENARIOS} from '@site/src/components/landing/rating';
import {COMPATIBLE} from '@site/src/components/landing/CompatSpread';
import {Protocols, Tools, toolsInWords, type ProtocolCard} from '@site/src/components/ratings/Ask';
import FitTable, {type Fit, type Workload} from '@site/src/components/ratings/FitTable';
import BenchTable from '@site/src/components/ratings/BenchTable';
import Drawer from '@site/src/components/conformity/Drawer';
import EngineDetail from '@site/src/components/ratings/EngineDetail';
import {Families, StorageEngines} from '@site/src/components/ratings/Sections';
import Unpublished from '@site/src/components/conformity/Unpublished';
import Errata from '@site/src/components/conformity/Errata';
import {BANDS, bandOf, fitShare, originalTpcc, runsOf, subjectsOf, toolFit, toolsOf, type Band} from '@site/src/components/ratings/fit';
import {parse, serialize, type State} from '@site/src/components/ratings/state';
import '../css/landing.css';
import '../css/ratings.css';

// Database ratings: what your clients speak (the protocol), then one of two
// measurements of every engine that claims it. Compatibility: the engines in
// a table, against the original and against the reader's own tools, a row
// opening the engine's side panel; under it, folded, forks, storage engines,
// what is held back and what we corrected. Benchmarks: Stroppy Cloud's rating
// of those engines. Data: the conformity export (static/data/conformity) and
// Stroppy Cloud's rating. Everything the reader picks lives in the query
// string (ratings/state.ts).

const compat = compatJson as unknown as Compat;
const errata = errataJson as unknown as ErrataFile;
const PROTOCOLS = protocolsOf(compat);

const unpublishedOf = (proto: string) => [...compat.not_measured, ...compat.withheld].filter((u) => u.protocol === proto);

const CARDS: ProtocolCard[] = PROTOCOLS.map((proto) => ({proto, engines: subjectsOf(compat, proto).length}));

/** The conformity engines of a protocol, the storage engines' builds included: whose runs the benchmarks show. */
const enginesOf = (proto: string) =>
  new Set([...compat.rows, ...compat.access_methods.rows].filter((r) => r.protocol === proto).map((r) => r.engine));

/** The band an engine is in when no tool is picked: its own score. Crashes are counted in the row. */
function bandByScore(overall: number | null | undefined): Band {
  if (typeof overall !== 'number') return 'unknown';
  return overall >= COMPATIBLE ? 'same' : 'differs';
}

/** A folded section under the table: its title and count; the URL's hash opens it. */
function Fold({id, title, n, children}: {id: string; title: string; n: number; children: ReactNode}) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(window.location.hash === `#${id}`), [id]);
  if (n === 0) return null;
  return (
    <details id={id} className="rp-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {title} <span>{n}</span>
      </summary>
      <div className="rp-fold__body">{children}</div>
    </details>
  );
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
    (next: Partial<State>) =>
      history.replace({search: serialize({...parse(window.location.search, PROTOCOLS), ...next}, PROTOCOLS), hash: window.location.hash}),
    [history],
  );
  const close = useCallback(() => set({db: null}), [set]);

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
  const q = st.q.trim().toLowerCase();
  const shown = q ? fits.filter((f) => f.row.target.toLowerCase().includes(q)) : fits;
  // The workloads some engine of the protocol ran, in the board's order, each with its unit and direction.
  const workloads: Workload[] = SCENARIOS.flatMap((s) => {
    const run = fits.flatMap((f) => f.runs).find((r) => r.label === s.label);
    return run ? [{label: s.label, unit: run.run.unit, higher: run.higher}] : [];
  });
  const opened = fits.find((f) => f.row.id === st.db);
  const mode = st.view === 'speed' ? 'speed' : 'engines';

  return (
    <Layout
      title="Database ratings"
      description="Every engine that claims to speak PostgreSQL, MySQL, MongoDB, Elasticsearch, Redis or S3, checked against the original and benchmarked: what works for your tools, what breaks, and how fast.">
      <main className="rp">
        <h1 className="rp-title">Database ratings</h1>

        <div className="rp-switches">
          <div className="rp-switch">
            <span className="rp-switch__label">Your clients speak</span>
            <Protocols cards={CARDS} value={st.proto} onPick={(p) => set({proto: p, tools: [], db: null, q: '', sort: null})} />
          </div>
          <div className="rp-switch">
            <span className="rp-switch__label">Measured by</span>
            <div className="rp-seg" role="tablist" aria-label="Measured by">
              {(
                [
                  ['engines', 'Compatibility'],
                  ['speed', 'Benchmarks'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  className={clsx(mode === id && 'is-on')}
                  onClick={() => set({view: id, db: null})}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mode === 'engines' && (
          <section aria-label={`Engines that claim ${original}, against it`}>
            {fits.length === 0 ? (
              <p className="rp-empty">No engine that claims {original} is published yet: see what is held back, below.</p>
            ) : (
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
                  <Tools proto={st.proto} tools={tools} picked={picked} onTools={(t) => set({tools: t})} />
                  <span className="rp-count">
                    {shown.length === fits.length ? `${fits.length} engines` : `${shown.length} of ${fits.length}`}
                  </span>
                </div>
                {pickedTools.length > 0 && (
                  <p className="rp-answer">
                    <b>
                      {count('same')} of {fits.length}
                    </b>{' '}
                    run {toolsInWords(picked)} the way {original} does.
                  </p>
                )}
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
                <p className="rp-meta rp-foot">
                  Each engine against the {original} version it reports, checked {day(compat.dataset.audited_at)}.{' '}
                  <Link to="/tools/conformity">How the checks work</Link>
                </p>
              </>
            )}

            <div className="rp-folds">
              <Fold
                id="rp-forks"
                title="Forks against the product they forked"
                n={compat.families.rows.filter((f) => f.protocol === st.proto).length}>
                <Families rows={compat.families.rows.filter((f) => f.protocol === st.proto)} />
              </Fold>
              <Fold
                id="rp-storage"
                title="Storage engines and extensions against their default"
                n={compat.access_methods.rows.filter((r) => r.protocol === st.proto && r.role === 'subject').length}>
                <StorageEngines rows={compat.access_methods.rows.filter((r) => r.protocol === st.proto && r.role === 'subject')} />
              </Fold>
              <Fold id="rp-held" title="Measured, held back, and why" n={unpublishedOf(st.proto).length}>
                <Unpublished rows={unpublishedOf(st.proto)} />
              </Fold>
              <Fold id="rp-errata" title="What we corrected" n={errata.entries.filter((e) => e.protocol === st.proto).length}>
                <Errata entries={errata.entries.filter((e) => e.protocol === st.proto)} />
                <p className="rp-meta">
                  Found an error? <Link to="/vendors#dispute">Report it</Link>
                </p>
              </Fold>
            </div>

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

        {mode === 'speed' && (
          <section aria-label={`Benchmarks of the engines that claim ${original}`}>
            <BenchTable key={st.proto} ratings={ratings} engines={enginesOf(st.proto)} original={original} />
          </section>
        )}
      </main>
    </Layout>
  );
}
