import {useState, type CSSProperties, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {CLOUD, engine, lastRun, SCENARIOS, shareUrl, topology} from './rating';
import useRatings from './useRatings';
import {Picker, summary, variant, type Attribute, type Picks, type Workload} from './variant';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});

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
 * The public rating, whole. A variant picker (workload, then topology, the
 * hardware class and the scale it ran at), then one table: one of each, never
 * mixed, each default the choice with the most runs. A row is a configuration,
 * its bar against the best one (the shortest time is the best for a
 * lower-is-better metric), the first three in gold, silver and bronze; it
 * opens its best run's report in Stroppy Cloud.
 */
export function TopBoard({more}: {more: {href: string; label: string}}) {
  const ratings = useRatings();
  const [picked, setPicked] = useState<string>('tx');
  const [picks, setPicks] = useState<Picks>({});
  const shown = SCENARIOS.filter((s) => (ratings[s.key]?.groups.length ?? 0) > 0);
  const workload = shown.find((s) => s.key === picked) ?? shown[0];
  const groups = workload ? (ratings[workload.key]?.groups ?? []) : [];
  if (!workload || groups.length === 0) {
    return (
      <div className="board board--empty">
        <p>
          Published runs are on <a href={`${CLOUD}/leaderboard`}>the Stroppy Cloud leaderboard</a>.
        </p>
      </div>
    );
  }
  const workloads: Attribute = {
    label: 'Workload',
    options: shown.map((s) => ({id: s.key, name: s.label, available: true})),
    value: workload.key,
    onPick: setPicked,
  };
  const metricOf = (w: Workload) => ratings[w.key]?.metric ?? null;
  const {group, attributes} = variant(workload, groups, picks, (p) => setPicks((was) => ({...was, ...p})));
  const {rows} = group;
  const metric = metricOf(workload);
  const lower = metric?.higher_is_better === false;
  // The longest table of all, so no choice moves the page below.
  const longest = Math.max(...shown.flatMap((s) => (ratings[s.key]?.groups ?? []).map((g) => g.rows.length)));
  const best = rows[0].value;
  const latest = lastRun(rows);
  return (
    <div className="board">
      {/* Every workload's picker at its defaults, unseen in the same cell: the
          head takes the tallest one's height, so no choice moves the table. */}
      <div className="board__head">
        <div className="board__shown">
          <Picker workload={workloads} attributes={attributes} />
          <p className="board__summary">{summary(group, metric)}</p>
        </div>
        {shown.map((w) => {
          const v = variant(w, ratings[w.key]?.groups ?? [], {}, () => undefined);
          return (
            <div key={w.key} className="board__sizer" aria-hidden="true" inert>
              <Picker workload={workloads} attributes={v.attributes} />
              <p className="board__summary">{summary(v.group, metricOf(w))}</p>
            </div>
          );
        })}
      </div>
      <ol className="board__rows" key={group.key}>
        {rows.map((r, i) => (
          <li
            key={`${r.db_kind}-${r.db_version}-${r.hardware.key}-${r.share_token ?? r.run_at}`}
            className={r.rank <= 3 ? `board__place--${r.rank}` : undefined}>
            <a
              className="board__row"
              href={shareUrl(r)}
              target="_blank"
              rel="noopener noreferrer"
              style={{'--w': String(lower ? best / r.value : r.value / best), '--i': String(i)} as CSSProperties}>
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
        {/* Blank rows up to the longer tab's count, so switching tabs never moves the page below. */}
        {Array.from({length: longest - rows.length}, (_, i) => (
          <li key={`blank-${i}`} className="board__blank" aria-hidden="true">
            <span className="board__row">
              <span className="board__rank" />
              <span className="board__who">
                <span className="board__db">&nbsp;</span>
                <span className="board__setup">&nbsp;</span>
              </span>
              <span className="board__value">&nbsp;</span>
              <span className="board__bar" />
            </span>
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
