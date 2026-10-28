import {useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import compatJson from '@site/static/data/conformity/compat.json';
import CompatMap from '@site/src/components/conformity/CompatMap';
import Drawer from '@site/src/components/conformity/Drawer';
import About, {AboutButton} from '@site/src/components/conformity/About';
import {day, protocolName, protocolShort, protocolsOf} from '@site/src/components/conformity/data';
import {StatesLegend} from '@site/src/components/conformity/Cell';
import type {Compat} from '@site/src/components/conformity/types';
import '../css/conformity.css';

// Which databases really speak the protocol they claim: stroppy-conformity's
// published dataset as one compatibility map per protocol. Tabs pick the
// protocol (#pgwire, #mysql, #mongo, #elastic); an engine opens in a drawer
// (#<row id>). The legend's five states sit above the map, its first caveat
// under it, the rest of the legend folded in "About this data" (#about).
// compat.json is read at build, so every map is in the HTML; an engine's
// findings (details/<id>.json) are fetched when its drawer opens. The
// export's contract: docs/site-export.md in stroppy-io/stroppy-conformity.

const data = compatJson as unknown as Compat;
const PROTOCOLS = protocolsOf(data);
const DEFAULT = PROTOCOLS.includes('pgwire') ? 'pgwire' : PROTOCOLS[0];

function setHash(h: string) {
  window.history.replaceState(null, '', `#${h}`);
}

function ConformityPage() {
  const anchors = useBrokenLinks();
  for (const id of [...PROTOCOLS, 'about']) anchors.collectAnchor(id);
  for (const r of data.rows) anchors.collectAnchor(r.id);

  const [protocol, setProtocol] = useState(DEFAULT);
  const [open, setOpen] = useState<string | null>(null);
  const [about, setAbout] = useState(false);

  // The hash picks the protocol, or an engine and its protocol, or opens
  // "About". A protocol's or an engine's hash names a tab or a row, not a
  // place to scroll to: the browser's jump to it is undone, so the page
  // stays whole on one screen.
  const fromHash = useCallback(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    const stay = () => window.requestAnimationFrame(() => window.scrollTo({top: 0}));
    if (PROTOCOLS.includes(h)) {
      setProtocol(h);
      setOpen(null);
      stay();
      return;
    }
    const row = data.rows.find((r) => r.id === h);
    if (row) {
      setProtocol(row.protocol);
      setOpen(row.role === 'reference' ? null : row.id);
      stay();
      return;
    }
    if (h === 'about') {
      setOpen(null);
      setAbout(true);
      stay();
    }
  }, []);

  useEffect(() => {
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [fromHash]);

  // The page opens at its top: the browser does not put back where an
  // earlier visit had scrolled to (Chrome does on reload), since the page
  // is one screen and only the map scrolls.
  useEffect(() => {
    const before = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const top = () => {
      window.scrollTo({top: 0});
    };
    top();
    // A restore the browser does after load would undo the one above.
    window.addEventListener('load', top, {once: true});
    return () => {
      window.removeEventListener('load', top);
      window.history.scrollRestoration = before;
    };
  }, []);

  // The map's box is as tall as the room under the sticky tabs
  // (src/css/conformity.css); the tabs wrap with the width, so they are
  // measured.
  const cbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = cbar.current;
    if (!bar) return undefined;
    const page = bar.parentElement;
    const ro = new ResizeObserver(() => page?.style.setProperty('--cbar-h', `${bar.offsetHeight}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const pick = (p: string) => {
    setProtocol(p);
    setOpen(null);
    setHash(p);
  };
  const openRow = (id: string) => {
    setOpen(id);
    setHash(id);
  };
  const closeAbout = useCallback(() => {
    setAbout(false);
    if (window.location.hash === '#about') setHash(protocol);
  }, [protocol]);
  const closeRow = useCallback(() => {
    setOpen(null);
    setHash(protocol);
  }, [protocol]);

  // Arrow keys move between the tabs.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = PROTOCOLS.indexOf(protocol);
    const next = PROTOCOLS[(i + (e.key === 'ArrowRight' ? 1 : PROTOCOLS.length - 1)) % PROTOCOLS.length];
    pick(next);
    document.getElementById(next)?.focus();
  };

  const row = open ? data.rows.find((r) => r.id === open) : undefined;
  const engines = (p: string) => data.rows.filter((r) => r.protocol === p && r.role !== 'reference').length;

  return (
    <main className="cf">
      <header className="cf-hero">
        <Heading as="h1" className="cf-hero__title">
          Which databases really speak the protocol they claim
        </Heading>
        <div className="cf-hero__intro">
          <p className="cf-lead">
            Measured check by check against the original engine: PostgreSQL, MySQL, MongoDB, Elasticsearch.
          </p>
          <p className="cf-prov">
            Dataset <code>{data.dataset.id}</code>
            {data.dataset.audited_at && <>, audited {day(data.dataset.audited_at)}</>}.
          </p>
        </div>
        <AboutButton onOpen={() => setAbout(true)} />
      </header>

      <div className="cbar" ref={cbar}>
        <div className="cbar__inner">
          <div className="tabs" role="tablist" aria-label="Protocol" onKeyDown={onTabKey}>
            {PROTOCOLS.map((p) => (
              <button
                key={p}
                id={p}
                type="button"
                role="tab"
                aria-selected={p === protocol}
                aria-controls={`panel-${p}`}
                tabIndex={p === protocol ? 0 : -1}
                onClick={() => pick(p)}>
                {protocolShort(p)}
                <span className="tabs__n">{engines(p)}</span>
              </button>
            ))}
          </div>
          <StatesLegend className="states--bar" />
        </div>
      </div>

      <div className="cf-wrap">
        <StatesLegend className="states--inline" />
        {PROTOCOLS.map((p) => (
          <section key={p} id={`panel-${p}`} role="tabpanel" aria-labelledby={p} hidden={p !== protocol} className="panel">
            <h2 className="panel__title">
              {protocolName(p)}
              <span>
                {engines(p)} engines, best first. Pick an engine for what differs; pick a column for its features.
              </span>
            </h2>
            <CompatMap data={data} protocol={p} onOpen={openRow} />
          </section>
        ))}
        <p className="cf-caveat">
          <span className="cf-caveat__text" title={data.legend.caveats[0]}>
            {data.legend.caveats[0]}
          </span>{' '}
          <a href="#about">All caveats and how scores are counted</a>
        </p>
      </div>

      {row && <Drawer data={data} row={row} onClose={closeRow} />}
      {about && <About data={data} onClose={closeAbout} />}
    </main>
  );
}

export default function Conformity(): ReactNode {
  return (
    <Layout
      title="Which databases really speak the protocol they claim"
      description="Databases that claim the PostgreSQL, MySQL, MongoDB or Elasticsearch wire protocol, measured check by check against the original engine.">
      <ConformityPage />
    </Layout>
  );
}
