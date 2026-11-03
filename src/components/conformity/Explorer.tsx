import {useCallback, useEffect, useState, type KeyboardEvent} from 'react';
import {useHistory, useLocation} from '@docusaurus/router';
import compatJson from '@site/static/data/conformity/compat.json';
import CompatMap from './CompatMap';
import Drawer from './Drawer';
import About, {AboutButton} from './About';
import {StatesLegend} from './Cell';
import {day, protocolName, protocolShort, protocolsOf} from './data';
import type {Compat} from './types';
import '../../css/conformity.css';

// stroppy-conformity's published dataset as one compatibility map per
// protocol, on /tools/conformity: tabs pick the protocol, an engine opens in a
// drawer, the legend's caveats and scoring are in "About this data". What is
// open lives in the query string (?map=<protocol>&engine=<row id>&about; see
// mapUrl in data.ts), since the page's hash names its sections. compat.json is
// read at build, so every map is in the HTML; an engine's findings
// (details/<id>.json) are fetched when its drawer opens. The export's
// contract: docs/site-export.md in stroppy-io/stroppy-conformity.

const data = compatJson as unknown as Compat;
const PROTOCOLS = protocolsOf(data);
const DEFAULT = PROTOCOLS.includes('pgwire') ? 'pgwire' : PROTOCOLS[0];

type View = {protocol: string; engine: string | null; about: boolean};

function parse(search: string): View {
  const q = new URLSearchParams(search);
  const row = data.rows.find((r) => r.id === q.get('engine'));
  const map = q.get('map');
  return {
    protocol: row?.protocol ?? (map && PROTOCOLS.includes(map) ? map : DEFAULT),
    engine: row && row.role !== 'reference' ? row.id : null,
    about: q.has('about'),
  };
}

function serialize(v: View): string {
  const q = new URLSearchParams();
  if (v.protocol !== DEFAULT) q.set('map', v.protocol);
  if (v.engine) q.set('engine', v.engine);
  if (v.about) q.set('about', '');
  const s = q.toString().replace(/=(?=&|$)/g, '');
  return s ? `?${s}` : '';
}

const engines = (p: string) => data.rows.filter((r) => r.protocol === p && r.role !== 'reference').length;

export default function Explorer() {
  const location = useLocation();
  const history = useHistory();
  // The URL is read after hydration, so the server's HTML and the first client render agree.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const view = parse(ready ? location.search : '');
  const set = useCallback(
    (next: Partial<View>) => {
      const v = {...parse(window.location.search), ...next};
      history.replace({search: serialize(v), hash: window.location.hash});
    },
    [history],
  );
  const pick = (p: string) => set({protocol: p, engine: null});
  const closeRow = useCallback(() => set({engine: null}), [set]);
  const closeAbout = useCallback(() => set({about: false}), [set]);

  // Arrow keys move between the tabs.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = PROTOCOLS.indexOf(view.protocol);
    const next = PROTOCOLS[(i + (e.key === 'ArrowRight' ? 1 : PROTOCOLS.length - 1)) % PROTOCOLS.length];
    pick(next);
    document.getElementById(`cf-tab-${next}`)?.focus();
  };

  const row = view.engine ? data.rows.find((r) => r.id === view.engine) : undefined;

  return (
    <div className="cf">
      <div className="cf-bar">
        <div className="tabs" role="tablist" aria-label="Protocol" onKeyDown={onTabKey}>
          {PROTOCOLS.map((p) => (
            <button
              key={p}
              id={`cf-tab-${p}`}
              type="button"
              role="tab"
              aria-selected={p === view.protocol}
              aria-controls={`cf-panel-${p}`}
              tabIndex={p === view.protocol ? 0 : -1}
              onClick={() => pick(p)}>
              {protocolShort(p)}
              <span className="tabs__n">{engines(p)}</span>
            </button>
          ))}
        </div>
        <AboutButton onOpen={() => set({about: true})} />
      </div>
      <StatesLegend />
      {PROTOCOLS.map((p) => (
        <div key={p} id={`cf-panel-${p}`} role="tabpanel" aria-labelledby={`cf-tab-${p}`} hidden={p !== view.protocol} className="panel">
          <h3 className="panel__title">
            {protocolName(p)}
            <span>{engines(p)} engines, best first. Pick an engine for what differs; pick a column for its features.</span>
          </h3>
          <CompatMap data={data} protocol={p} onOpen={(id) => set({engine: id})} />
        </div>
      ))}
      <p className="cf-caveat">
        <span className="cf-caveat__text">{data.legend.caveats[0]}</span>{' '}
        <button type="button" className="cf-link" onClick={() => set({about: true})}>
          All caveats and how scores are counted
        </button>
      </p>
      <p className="cf-prov">
        Dataset <code>{data.dataset.id}</code>
        {data.dataset.audited_at && <>, audited {day(data.dataset.audited_at)}</>}.
      </p>

      {row && <Drawer data={data} row={row} onClose={closeRow} />}
      {view.about && <About data={data} onClose={closeAbout} />}
    </div>
  );
}
