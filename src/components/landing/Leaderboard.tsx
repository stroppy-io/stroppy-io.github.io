import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';
import {useColorMode} from '@docusaurus/theme-common';
import {CLOUD, engine, fetchRating, machine, shareUrl, topology, workload, type Rating} from './rating';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});

/** The build's copy of the rating, refreshed from the cloud once the page is up. */
function useRating(): Rating | null {
  const {rating} = usePluginData('cloud-rating') as {rating: Rating | null};
  const [live, setLive] = useState(rating);
  useEffect(() => {
    const ac = new AbortController();
    fetchRating(ac.signal)
      .then(setLive)
      .catch(() => undefined);
    return () => ac.abort();
  }, []);
  return live;
}

/**
 * The top of the public rating, in the hero: one row per run, its bar
 * against the best one. A row opens that run's report in Stroppy Cloud.
 */
export function TopBoard({limit = 5}: {limit?: number}) {
  const rating = useRating();
  const rows = rating?.data.slice(0, limit) ?? [];
  if (!rating || rows.length === 0) {
    return (
      <div className="board board--empty">
        <span className="board__label">Leaderboard</span>
        <p>
          Published runs are on <a href={`${CLOUD}/leaderboard`}>the Stroppy Cloud leaderboard</a>.
        </p>
      </div>
    );
  }
  const top = rows[0].value;
  const latest = rows.reduce((a, r) => (r.run_at > a ? r.run_at : a), rows[0].run_at);
  return (
    <div className="board">
      <div className="board__head">
        <span className="board__label">
          Leaderboard
        </span>
        <span className="board__workload">{workload(rows[0])}</span>
      </div>
      <ol className="board__rows">
        {rows.map((r, i) => (
          <li key={`${r.rank}-${r.share_token ?? r.run_at}`}>
            <a
              className="board__row"
              href={shareUrl(r)}
              target="_blank"
              rel="noopener noreferrer"
              style={{'--w': String(r.value / top), '--i': String(i)} as CSSProperties}>
              <span className="board__rank">{r.rank}</span>
              <span className="board__who">
                <span className="board__db">
                  {engine(r.db_kind)} {r.db_version}
                </span>
                <span className="board__setup">
                  {topology(r)} · {machine(r)}
                </span>
              </span>
              <span className="board__value">
                {fmt(r.value)}
                <span className="board__unit"> {r.unit}</span>
              </span>
              <span className="board__bar" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
      <div className="board__foot">
        <span>Latest run {day(latest)}</span>
        <a href="#results">All results, with filters ↓</a>
      </div>
    </div>
  );
}

const EMBED = `${CLOUD}/embed/leaderboard?filters=1&bg=transparent`;

type EmbedMessage = {type: 'stroppy-embed:ready'} | {type: 'stroppy-embed:height'; height: number};

/**
 * Stroppy Cloud's full leaderboard with its filters, in a frame. The frame
 * reports its height and when it has drawn (web/AGENTS.md §6a in
 * stroppy-cloud); the page sends it the site's theme.
 */
export function ResultsFrame() {
  const {colorMode} = useColorMode();
  const frame = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);

  // The first theme goes in the URL. It is read from <html>: while the page
  // hydrates, useColorMode still answers the default.
  useEffect(() => {
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    setSrc(`${EMBED}&theme=${theme}`);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent<EmbedMessage>) => {
      if (e.origin !== CLOUD || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'stroppy-embed:height') setHeight(e.data.height);
      if (e.data?.type === 'stroppy-embed:ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    const t = window.setTimeout(() => setSlow(true), 15_000);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({type: 'stroppy-embed:theme', theme: colorMode}, CLOUD);
  }, [colorMode, ready]);

  return (
    <div className={ready ? 'results results--ready' : 'results'}>
      {!ready && (
        <div className="results__wait">
          {slow ? (
            <>
              The leaderboard is taking a while. <a href={`${CLOUD}/leaderboard`}>Open it in Stroppy Cloud</a>.
            </>
          ) : (
            'Loading the leaderboard…'
          )}
        </div>
      )}
      {src && (
        <iframe
          ref={frame}
          className="results__frame"
          src={src}
          title="Stroppy Cloud leaderboard"
          loading="lazy"
          style={{height: height ?? undefined}}
        />
      )}
    </div>
  );
}
