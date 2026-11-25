import {useState, type CSSProperties} from 'react';
import type {CloudRating} from '../../../plugins/cloud-rating';
import {CLOUD, engine, lastRun, metricLabel, SCENARIOS, shareUrl, topology, type Group, type RatingRow} from '../landing/rating';
import {Picker, summary, variant, type Attribute, type Picks} from '../landing/variant';
import {engineOfRun} from './fit';

// Stroppy Cloud's published rating for one protocol's engines, as Cloud
// lists a rating (stroppy-cloud web/docs/tables-guide.md, "Рейтинг"): the
// variant picker of the landing's board (a workload, then topology, CPU,
// disk, scale), then a table of the configurations that ran it there: place,
// database and topology, the value with a bar against the best, the median,
// how many runs, the latest; a row opens its run's report in Cloud. Only the
// engines that speak the protocol, ranked among themselves.

type Props = {ratings: CloudRating; engines: Set<string>; original: string};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});

/** A group's rows of the protocol's engines, re-ranked among themselves; null when none is. */
function only(g: Group, engines: Set<string>): Group | null {
  const rows = g.rows.filter((r) => engines.has(engineOfRun(r) ?? ''));
  return rows.length ? {...g, rows: rows.map((r, i) => ({...r, rank: i + 1})), runs: rows.reduce((n, r) => n + r.runs, 0)} : null;
}

export default function BenchTable({ratings, engines, original}: Props) {
  const [picked, setPicked] = useState<string>('tx');
  const [picks, setPicks] = useState<Picks>({});
  const groupsOf = (key: string) =>
    (ratings[key as keyof CloudRating]?.groups ?? []).map((g) => only(g, engines)).filter((g) => g !== null);
  const shown = SCENARIOS.filter((s) => groupsOf(s.key).length > 0);
  const workload = shown.find((s) => s.key === picked) ?? shown[0];
  if (!workload) {
    return (
      <p className="rp-empty">
        No {original} engine has a published run yet. Every run is on <a href={`${CLOUD}/leaderboard`}>the Stroppy Cloud leaderboard</a>.
      </p>
    );
  }
  const workloads: Attribute = {
    label: 'Workload',
    options: shown.map((s) => ({id: s.key, name: s.label, available: true})),
    value: workload.key,
    onPick: setPicked,
  };
  const metric = ratings[workload.key]?.metric ?? null;
  const {group, attributes} = variant(workload, groupsOf(workload.key), picks, (p) => setPicks((was) => ({...was, ...p})));
  const lower = metric?.higher_is_better === false;
  const best = group.rows[0].value;
  const unit = group.rows[0].unit;
  const share = (r: RatingRow) => (lower ? best / r.value : r.value / best);
  // TPC-C is speed, the rest analytics: the colours of the compatibility table's columns.
  const kind = workload.label.startsWith('TPC-C') ? 'speed' : 'analytics';

  return (
    <div className="rp-bench">
      <Picker workload={workloads} attributes={attributes} />
      <p className="rp-meta rp-bench__where">{summary(group, metric)}</p>
      <div className="rp-table-box">
        <table className="rp-table" aria-label={`${workload.label} of ${original} engines`}>
          <thead>
            <tr>
              <th scope="col" className="rp-c-rank">
                <span className="rp-head">#</span>
              </th>
              <th scope="col">
                <span className="rp-head">Database</span>
              </th>
              <th scope="col" className="rp-c-num">
                <span className="rp-head">
                  <i className={`rp-dot rp-dot--${kind}`} aria-hidden="true" />
                  {metric ? metricLabel(metric, group.rows[0]) : unit}
                </span>
              </th>
              <th scope="col" className="rp-c-crash">
                <span className="rp-head">Median</span>
              </th>
              <th scope="col" className="rp-c-crash">
                <span className="rp-head">Runs</span>
              </th>
              <th scope="col" className="rp-c-crash">
                <span className="rp-head">Latest run</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r) => (
              <tr
                key={`${r.db_kind}-${r.db_version}-${r.share_token ?? r.run_at}`}
                onClick={() => window.open(shareUrl(r), '_blank', 'noopener')}>
                <td className="rp-c-rank">{r.rank}</td>
                <td>
                  <a className="rp-name" href={shareUrl(r)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <b>
                      {engine(r.db_kind)} {r.db_version}
                    </b>{' '}
                    <span>{topology(r)}</span>
                  </a>
                </td>
                <td className="rp-c-num">
                  <span className={`rp-num rp-num--${kind}`} style={{'--value': `${Math.min(1, share(r)) * 100}%`} as CSSProperties}>
                    <span className="rp-num__v">{fmt(r.value)}</span>
                    <span className="rp-bar" aria-hidden="true" />
                  </span>
                </td>
                <td className="rp-c-crash">{fmt(r.median)}</td>
                <td className="rp-c-crash">{r.runs}</td>
                <td className="rp-c-crash">{day(r.last_run_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rp-meta rp-bench__foot">
        Each configuration’s best run in 30 days, latest {day(lastRun(group.rows))}. Every run is on{' '}
        <a href={`${CLOUD}/leaderboard`}>the Stroppy Cloud leaderboard</a>.
      </p>
    </div>
  );
}
