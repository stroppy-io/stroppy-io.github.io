import {useState, type CSSProperties, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {CLOUD, engine, machine, shareUrl, topology, workload} from './rating';
import useRatings from './useRatings';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});

/** The two TPC-C ratings: a round trip per statement, and stored procedures. */
const SCENARIOS = [
  {id: 'rating', label: 'Transactions'},
  {id: 'procs', label: 'Stored procedures'},
] as const;
type ScenarioId = (typeof SCENARIOS)[number]['id'];

const TROPHY = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  </svg>
);

const MEDAL = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 3l3 6M17 3l-3 6" />
    <circle cx="12" cy="15" r="6" />
  </svg>
);

/** A trophy for the first place, a medal for the next two, the number after; the rank stays readable. */
function Rank({rank}: {rank: number}): ReactNode {
  if (rank > 3) return rank;
  return (
    <>
      {rank === 1 ? TROPHY : MEDAL}
      <span className="visually-hidden">{rank}</span>
    </>
  );
}

/**
 * The public rating, whole: one row per run, its bar against the best one,
 * the first three in gold, silver and bronze. A row opens that run's report
 * in Stroppy Cloud.
 */
export function TopBoard({more}: {more: {href: string; label: string}}) {
  const ratings = useRatings();
  const [scenario, setScenario] = useState<ScenarioId>('rating');
  const rows = ratings[scenario]?.data ?? [];
  const tabs = (
    <div className="board__tabs" role="group" aria-label="TPC-C variant">
      {SCENARIOS.map((s) => (
        <button key={s.id} type="button" aria-pressed={s.id === scenario} onClick={() => setScenario(s.id)}>
          {s.label}
        </button>
      ))}
    </div>
  );
  if (rows.length === 0) {
    return (
      <div className="board board--empty">
        {tabs}
        <p>
          Published runs are on <a href={`${CLOUD}/leaderboard`}>the Stroppy Cloud leaderboard</a>.
        </p>
      </div>
    );
  }
  const best = rows[0].value;
  const latest = rows.reduce((a, r) => (r.run_at > a ? r.run_at : a), rows[0].run_at);
  return (
    <div className="board">
      <div className="board__head">
        <span className="board__workload">
          {workload(rows[0])} · {machine(rows[0])}
        </span>
        {tabs}
      </div>
      <ol className="board__rows" key={scenario}>
        {rows.map((r, i) => (
          <li key={`${r.rank}-${r.share_token ?? r.run_at}`} className={r.rank <= 3 ? `board__place--${r.rank}` : undefined}>
            <a
              className="board__row"
              href={shareUrl(r)}
              target="_blank"
              rel="noopener noreferrer"
              style={{'--w': String(r.value / best), '--i': String(i)} as CSSProperties}>
              <span className="board__rank">
                <Rank rank={r.rank} />
              </span>
              <span className="board__who">
                <span className="board__db">
                  {engine(r.db_kind)} {r.db_version}
                </span>
                <span className="board__setup">{topology(r)}</span>
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
        <Link to={more.href}>{more.label}</Link>
      </div>
    </div>
  );
}
