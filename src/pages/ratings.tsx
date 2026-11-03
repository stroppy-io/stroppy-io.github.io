import {useCallback, useEffect, useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import {useHistory, useLocation} from '@docusaurus/router';
import {usePluginData} from '@docusaurus/useGlobalData';
import compatJson from '@site/static/data/conformity/compat.json';
import type {Compat} from '@site/src/components/conformity/types';
import {day, protocolShort, protocolsOf} from '@site/src/components/conformity/data';
import {fetchRating, SCENARIO, SCENARIO_PROCS} from '@site/src/components/landing/rating';
import type {CloudRating} from '@site/plugins/cloud-rating';
import Picks from '@site/src/components/ratings/Picks';
import Filters from '@site/src/components/ratings/Filters';
import RatingsTable from '@site/src/components/ratings/RatingsTable';
import EnginePanel from '@site/src/components/ratings/EnginePanel';
import {
  AVERAGES,
  CATEGORIES,
  KIND_LABELS,
  KINDS,
  PICKS,
  average,
  baseline,
  category,
  engines,
  score,
  winners,
  type Engine,
  type Kind,
  type PickId,
} from '@site/src/components/ratings/score';
import {parse, serialize, type State} from '@site/src/components/ratings/state';
import '../css/ratings.css';

// Databases rated against the original they claim to replace: conformity
// (static/data/conformity, read at build) and TPC-C from Stroppy Cloud (a
// copy taken at build by plugins/cloud-rating.ts, refreshed in the browser).
// Everything the reader picks lives in the query string (components/ratings/state.ts).

const compat = compatJson as unknown as Compat;
const PROTOCOLS = protocolsOf(compat);

const KIND_TITLE: Record<Kind, string> = {
  oltp: 'Transactional databases',
  analytics: 'Analytical databases',
  search: 'Search engines',
  proxy: 'Proxies and poolers',
};

/** The heading names the view, so a jump from the menu visibly lands somewhere. */
function viewTitle(st: State, name: string): string {
  if (st.min >= 9 && st.clean) return `Drop-in replacements for ${name} clients`;
  if (st.bench && st.sort === 'speed') return `The fastest databases for ${name} clients`;
  if (st.kind) return `${KIND_TITLE[st.kind]} for ${name} clients`;
  return `Databases for ${name} clients, rated`;
}

/** What narrows or orders the view, in words; empty for the plain view. */
function viewFacts(st: State): string[] {
  const sortLabel = CATEGORIES.find((c) => c.id === st.sort)?.label.toLowerCase();
  return [
    st.kind && KIND_LABELS[st.kind].toLowerCase(),
    st.min > 0 && `compatibility ${st.min.toFixed(1)} or more`,
    st.clean && 'nothing broken',
    st.bench && 'with a TPC-C run',
    sortLabel && `by ${sortLabel}`,
  ].filter((f): f is string => typeof f === 'string');
}

/** The build's copy of both TPC-C ratings, refreshed from the cloud once the page is up. */
function useRatings(): CloudRating {
  const built = usePluginData('cloud-rating') as CloudRating;
  const [live, setLive] = useState(built);
  useEffect(() => {
    const ac = new AbortController();
    Promise.all([fetchRating(SCENARIO, ac.signal), fetchRating(SCENARIO_PROCS, ac.signal)])
      .then(([rating, procs]) => setLive({rating, procs}))
      .catch(() => undefined);
    return () => ac.abort();
  }, []);
  return live;
}

export default function RatingsPage() {
  const ratings = useRatings();
  const all = useMemo(() => engines(compat, ratings.rating, ratings.procs), [ratings]);
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

  const base = baseline(all, st.proto);
  const others = all
    .filter((e) => e.protocol === st.proto && e.original && e !== base)
    .sort((a, b) => b.name.localeCompare(a.name, undefined, {numeric: true}));
  const ofProto = all.filter((e) => e.protocol === st.proto && !e.original);
  const kinds = KINDS.filter((k) => ofProto.some((e) => e.kind === k));
  const alts = ofProto.filter((e) => st.kind === null || e.kind === st.kind);
  const shown = alts.filter(
    (e) =>
      (!st.min || (average(CATEGORIES[0], e, base) ?? 0) >= st.min) &&
      (!st.clean || e.breaks === 0) &&
      (!st.bench || Boolean(e.tx || e.procs)),
  );
  const key = (e: Engine) =>
    st.sort === 'score'
      ? score(e, base, st.view)?.value
      : category(CATEGORIES.find((c) => c.id === st.sort) ?? CATEGORIES[0], e, base, st.view[st.sort]);
  // Unmeasured last; ties go to the engine with more categories run, then by name.
  shown.sort((a, b) => {
    const x = key(a),
      y = key(b);
    if ((x === undefined) !== (y === undefined)) return x === undefined ? 1 : -1;
    return (
      ((x ?? 0) - (y ?? 0)) * st.dir ||
      (score(b, base, AVERAGES)?.measured ?? 0) - (score(a, base, AVERAGES)?.measured ?? 0) ||
      a.name.localeCompare(b.name)
    );
  });

  const won = winners(all, st.proto, st.kind);
  const awards = new Map<string, PickId[]>();
  for (const p of PICKS) {
    const e = won[p.id];
    if (e) awards.set(e.id, [...(awards.get(e.id) ?? []), p.id]);
  }
  const open = all.find((e) => e.id === st.db);
  const name = protocolShort(st.proto);
  const facts = viewFacts(st);
  const close = useCallback(() => set({db: null}), [set]);

  return (
    <Layout
      title="Database ratings"
      description="Databases rated against the original they claim to replace: compatibility and TPC-C speed, measured the same way.">
      <main className="rt">
        <div className="rt-top">
          <h1>{viewTitle(st, name)}</h1>
          <div className="rt-seg" role="tablist" aria-label="Protocol">
            {PROTOCOLS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={p === st.proto}
                onClick={() => set({proto: p, kind: null, db: null, refs: false})}>
                {protocolShort(p)}
              </button>
            ))}
          </div>
        </div>
        {facts.length > 0 && (
          <p className="rt-view">
            {facts.join(' · ')} · {shown.length} of {ofProto.length}
          </p>
        )}
        <p className="rt-dataset">
          Conformity: dataset of {day(compat.dataset.audited_at)} · TPC-C: Stroppy Cloud, one 32 vCPU · 128 GB node, latest run
        </p>
        {/* Keyed on what the menu switches, so a jump from it replays the entry. */}
        <div key={`picks-${st.proto}-${st.kind}`} className="page-enter">
          <Picks winners={won} base={base} onOpen={(id) => set({db: id})} />
        </div>
        <Filters
          kind={st.kind}
          kinds={kinds}
          min={st.min}
          clean={st.clean}
          bench={st.bench}
          shown={shown.length}
          total={ofProto.length}
          onChange={(f) => set(f)}
        />
        <div key={`table-${st.proto}-${st.kind}`} className="page-enter">
          <RatingsTable
            base={base}
            others={others}
            showRefs={st.refs}
            rows={shown}
            views={st.view}
            sort={st.sort}
            dir={st.dir}
            awards={awards}
            selected={st.db}
            onSort={(s) => set({sort: s, dir: st.sort === s ? (st.dir < 0 ? 1 : -1) : -1})}
            onView={(c, v) => set({view: {...st.view, [c]: v}})}
            onToggleRefs={() => set({refs: !st.refs})}
            onOpen={(id) => set({db: id})}
          />
        </div>
        <p className="rt-foot">
          Score: the mean of the categories that were run, out of 10; “1 of 2” says how many. The baseline is the original every engine is
          compared with, so it scores 10 by definition. {CATEGORIES.map((c) => `${c.label}: ${c.how}.`).join(' ')} Hover a cell for its
          parts; open a row for all of them.
        </p>
      </main>
      {open && (
        <EnginePanel
          engine={open}
          base={baseline(all, open.protocol)}
          protocolName={protocolShort(open.protocol)}
          awards={awards.get(open.id) ?? []}
          onClose={close}
        />
      )}
    </Layout>
  );
}
