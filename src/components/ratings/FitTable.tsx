import type {CSSProperties, ReactNode} from 'react';
import clsx from 'clsx';
import {percent, stateInfo} from '../conformity/data';
import type {Row} from '../conformity/types';
import {breaksOf, type Band, type EngineRun, type ToolFit} from './fit';
import '../../css/compat-map.css';

// Every engine that claims the protocol, as the tables guide of Stroppy
// Cloud lays a list out (stroppy-cloud web/docs/tables-guide.md), in the
// ratings' look: a place, the engine's name and version, then a column per
// thing to compare: the score as a chip in its tone, numbers in a monospaced
// face with a bar in the colour of what they measure (compatibility, TPC-C,
// analytics) and the unit in the header, "—" where there is none. Every column sorts (off,
// ascending, descending); the order otherwise is what the engine means for
// the reader's tools, then its score. A row opens the engine in the side
// panel. The table scrolls in its own box under a held header.

export type Fit = {
  row: Row;
  band: Band;
  /** Per picked tool, how it fares on this engine. */
  cells: ToolFit[];
  runs: EngineRun[];
  /** TPC-C tpmC as a share of the original's on the same machine. */
  share?: number;
};

/** A workload some engine of the table ran: its label, unit and which way is better. */
export type Workload = {label: string; unit: string; higher: boolean};

type Props = {
  original: string;
  tools: string[];
  workloads: Workload[];
  fits: Fit[];
  sort: string | null;
  dir: 'asc' | 'desc';
  onSort: (sort: string | null, dir: 'asc' | 'desc') => void;
  open: string | null;
  onOpen: (id: string) => void;
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const BAND_RANK: Record<Band, number> = {same: 0, differs: 1, breaks: 2, unknown: 3};

/** A band as the status cell shows it: the conformity map's glyph and a word. */
const BAND_STATE = {same: 'same', differs: 'differs', breaks: 'breaks', unknown: 'none'} as const;

type Column = {
  key: string;
  label: ReactNode;
  title?: string;
  className: string;
  /** The value the column sorts by; undefined sorts last either way. */
  value: (f: Fit) => number | string | undefined;
  cell: (f: Fit) => ReactNode;
};

/** A number, then a bar as long as its share of the column's best, in the colour of what it measures. */
function Num({text, share, kind, title}: {text: string; share: number; kind: 'speed' | 'analytics'; title?: string}) {
  return (
    <span className={`rp-num rp-num--${kind}`} title={title}>
      <span className="rp-num__v">{text}</span>
      <span className="rp-bar" style={{'--value': `${Math.max(0, Math.min(1, share)) * 100}%`} as CSSProperties} aria-hidden="true" />
    </span>
  );
}

/** Quality, not category: green from the line we call compatible, amber from half, red below. */
const tone = (v: number) => (v >= 80 ? 'good' : v >= 50 ? 'fair' : 'poor');

/** The score as a chip in its tone, a bar in the compatibility colour after it. */
function Score({value}: {value: number}) {
  return (
    <span className="rp-score" style={{'--value': `${value}%`} as CSSProperties}>
      <b className={`rp-tone--${tone(value)}`}>{percent(value)}</b>
      <span className="rp-bar" aria-hidden="true" />
    </span>
  );
}

export default function FitTable({original, tools, workloads, fits, sort, dir, onSort, open, onOpen}: Props) {
  const bestOf = (w: Workload) => {
    const v = fits.flatMap((f) => f.runs.filter((r) => r.label === w.label).map((r) => r.run.value));
    return v.length ? (w.higher ? Math.max(...v) : Math.min(...v)) : undefined;
  };
  const runOf = (f: Fit, label: string) => f.runs.find((r) => r.label === label)?.run;
  // The order shown, set once the columns are known; the place column reads it.
  let rows: Fit[] = fits;

  const columns: Column[] = [
    {
      key: 'status',
      label: '#',
      title: 'Place in the order shown; sorted by what the engine means for your tools when no column is',
      className: 'rp-c-rank',
      value: (f) => BAND_RANK[f.band],
      cell: (f) => {
        const info = stateInfo(BAND_STATE[f.band]);
        return (
          <span title={info.label}>
            {rows.indexOf(f) + 1}
            <span className="sr">, {info.label}</span>
          </span>
        );
      },
    },
    {
      key: 'name',
      label: 'Engine',
      className: 'rp-c-name',
      value: (f) => f.row.target,
      cell: (f) => {
        const sub = f.row.variant ? `${f.row.claims} · ${f.row.variant}` : f.row.claims;
        return (
          <button type="button" className="rp-name" onClick={() => onOpen(f.row.id)} title={`${f.row.target}, ${sub}`}>
            <b>{f.row.target}</b> <span>{sub}</span>
          </button>
        );
      },
    },
    ...tools.map((t, i): Column => ({
      key: `tool:${t}`,
      label: t,
      title: `Of the features ${t} uses, how many answered like ${original}`,
      className: 'rp-c-tool',
      value: (f) => (f.cells[i].of ? f.cells[i].same / f.cells[i].of : undefined),
      cell: (f) => {
        const c = f.cells[i];
        if (!c.of) return <span className="rp-dash">—</span>;
        const info = stateInfo(c.state);
        return (
          <span className={`c--${c.state}`} title={`${info.label}: ${c.same} of ${c.of} features answered like ${original}`}>
            <span className="c__glyph" aria-hidden="true">
              {info.glyph}
            </span>{' '}
            {c.same}/{c.of}
          </span>
        );
      },
    })),
    {
      key: 'compat',
      label: (
        <>
          <i className="rp-dot rp-dot--compat" aria-hidden="true" />
          Like {original}, %
        </>
      ),
      title: `The share of checks the engine answered like ${original}`,
      className: 'rp-c-num',
      value: (f) => f.row.scores.overall ?? undefined,
      cell: (f) => (typeof f.row.scores.overall === 'number' ? <Score value={f.row.scores.overall} /> : <span className="rp-dash">—</span>),
    },
    ...workloads.map((w): Column => {
      const best = bestOf(w);
      return {
        key: `run:${w.label}`,
        label: (
          <>
            <i className={`rp-dot rp-dot--${w.label.startsWith('TPC-C') ? 'speed' : 'analytics'}`} aria-hidden="true" />
            {w.label}, {w.unit}
          </>
        ),
        title: `${w.label}, ${w.higher ? 'higher' : 'lower'} is better; the bar against the best in this table`,
        className: 'rp-c-num',
        value: (f) => runOf(f, w.label)?.value,
        cell: (f) => {
          const run = runOf(f, w.label);
          if (!run || best === undefined) return <span className="rp-dash">—</span>;
          const vsOriginal = w.label === 'TPC-C' && f.share !== undefined ? `, ${Math.round(f.share * 100)}% of ${original}` : '';
          return (
            <Num
              text={fmt(run.value)}
              kind={w.label.startsWith('TPC-C') ? 'speed' : 'analytics'}
              share={w.higher ? run.value / best : best / run.value}
              title={`${fmt(run.value)} ${run.unit}${vsOriginal}`}
            />
          );
        },
      };
    }),
    {
      key: 'crash',
      label: 'Crashes, hangs',
      title: 'Crashes, hangs, unresponsive sessions and broken protocol messages during the checks',
      className: 'rp-c-crash',
      value: (f) => breaksOf(f.row),
      cell: (f) => {
        const n = breaksOf(f.row);
        return n ? <span className="rp-bad">{n}</span> : <span className="rp-dash">—</span>;
      },
    },
  ];

  const col = columns.find((c) => c.key === sort);
  rows = col
    ? [...fits].sort((a, b) => {
        const x = col.value(a),
          y = col.value(b);
        if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
        const d = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : x - y;
        return dir === 'asc' ? d : -d;
      })
    : fits;

  // Off, ascending, descending, off: the cycle the tables guide sets.
  const next = (key: string) => {
    if (sort !== key) onSort(key, 'asc');
    else if (dir === 'asc') onSort(key, 'desc');
    else onSort(null, 'desc');
  };

  return (
    <div className="rp-table-box">
      <table className="rp-table" aria-label={`Engines that claim ${original}`}>
        <thead>
          <tr>
            {columns.map((c) => {
              const on = c.key === sort;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={c.className}
                  title={c.title}
                  aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button type="button" className={clsx('rp-sort', on && 'is-on')} onClick={() => next(c.key)}>
                    {c.label}
                    <span className="rp-sort__icon" aria-hidden="true">
                      {on ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.row.id} className={clsx(open === f.row.id && 'is-open')} onClick={() => onOpen(f.row.id)}>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.cell(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
