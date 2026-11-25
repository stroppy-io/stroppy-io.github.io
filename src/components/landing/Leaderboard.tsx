import {useState, type CSSProperties, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {
  CLOUD,
  engine,
  lastRun,
  machineTags,
  metricLabel,
  SCENARIOS,
  shareUrl,
  topology,
  type Group,
  type Metric,
  type RatingRow,
} from './rating';
import useRatings from './useRatings';

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

type Option = {id: string; name: string; available: boolean};
type Attribute = {label: string; options: Option[]; value: string; onPick: (id: string) => void};

/** An attribute: its name and the chosen value over its options, a segmented control. */
function Choice({attribute: a}: {attribute: Attribute}) {
  return (
    <fieldset className="picker__attr">
      <legend>
        {a.label}: <b>{a.options.find((o) => o.id === a.value)?.name}</b>
      </legend>
      <div className="picker__options">
        {a.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="picker__option"
            aria-pressed={o.id === a.value}
            disabled={!o.available}
            onClick={() => a.onPick(o.id)}>
            {o.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The variant picker: the workload across the top, then where it ran, two
 * attributes a line (one on a phone). Every option of the workload stays in
 * place; the ones the choices above rule out are struck out and inactive, so
 * the picker never changes shape.
 */
function Picker({workload, attributes}: {workload: Attribute; attributes: Attribute[]}) {
  return (
    <div className="picker">
      <Choice attribute={workload} />
      <div className="picker__grid">
        {attributes.map((a) => (
          <Choice key={a.label} attribute={a} />
        ))}
      </div>
    </div>
  );
}

/** Each distinct value in the groups' order (most runs first). */
const distinct = <T,>(xs: T[]) => [...new Set(xs)];

type Workload = (typeof SCENARIOS)[number];

/** What a reader picks, top to bottom: each narrows the groups the next one chooses among. */
const FACETS = [
  {key: 'topology', label: 'Topology', of: (g: Group) => g.topology},
  {key: 'cpu', label: 'CPU', of: (g: Group) => g.cpu},
  {key: 'disk', label: 'Disk', of: (g: Group) => g.disk},
  {key: 'scale', label: 'Scale', of: (g: Group) => String(g.scaleFactor ?? '')},
] as const;

type Picks = Partial<Record<(typeof FACETS)[number]['key'], string>>;

/**
 * A workload's picker and the group it lands on. Each facet lists every value
 * the workload has (scales in order, the rest most runs first); its choice
 * falls back to the first value left under the choices above it, and the
 * values those rule out stay listed but unavailable.
 */
function variant(workload: Workload, groups: Group[], picks: Picks, onPick: (p: Picks) => void) {
  let left = groups;
  const attributes = FACETS.map((f): Attribute => {
    const all = distinct(groups.map(f.of));
    if (f.key === 'scale') all.sort((x, y) => Number(x) - Number(y));
    const here = distinct(left.map(f.of));
    const picked = picks[f.key];
    const value = picked !== undefined && here.includes(picked) ? picked : here[0];
    left = left.filter((g) => f.of(g) === value);
    const name = (v: string) => (f.key !== 'scale' ? v : v === '' ? 'any' : workload.scale(Number(v)));
    return {
      label: f.label,
      options: all.map((v) => ({id: v, name: name(v), available: here.includes(v)})),
      value,
      onPick: (id) => onPick({[f.key]: id}),
    };
  });
  return {group: left[0], attributes};
}

/** The machine and the metric in one line, less what the picker already names. */
function summary(group: Group, metric: Metric | null): string {
  const row = group.rows[0];
  const named = [group.cpu, group.disk];
  return [...machineTags(row).filter((t) => !named.includes(t.replace(/ SSD$/, ''))), ...(metric ? [metricLabel(metric, row)] : [])].join(
    ' · ',
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
