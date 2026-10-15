import {useRef, type CSSProperties, type ReactNode} from 'react';
import useScrollProgress from './useScrollProgress';

// One plot of published measurements, in groups, on a shared logarithmic
// axis of operations per second. Each row is a pair: the point compared with,
// and Stroppy (or the later Stroppy). As the plot scrolls into view each
// Stroppy point travels out from its pair, row after row, and travels back
// when the plot scrolls out.

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const fmt = (n: number) => n.toLocaleString('en-US');
const short = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`
    : n >= 1e4
      ? `${Math.round(n / 1000)}k`
      : n >= 1000
        ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
        : String(n);

// The axis: 10^2 … 10^7 per second.
const LOG_MIN = 2;
const LOG_MAX = 7;
const TICKS = [100, 1e3, 1e4, 1e5, 1e6, 1e7];
const x = (v: number) => ((Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;

export type Pair = {label: string; them: number; us: number; unit?: string};
// `per` names what the group's multipliers are relative to.
export type Group = {title: string; per: string; setting: ReactNode; rows: Pair[]};

function Row({pair, p, row}: {pair: Pair; p: number; row: number}) {
  const from = Math.log10(pair.them);
  const to = Math.log10(pair.us);
  const now = 10 ** (from + (to - from) * p);
  const ratio = pair.us / pair.them;
  const done = clamp((p - 0.7) / 0.3);
  const style = {
    gridRow: row,
    '--from': `${x(pair.them)}%`,
    '--now': `${x(now)}%`,
    '--done': String(done),
  } as CSSProperties;
  const unit = pair.unit ?? 'transactions';
  return (
    <>
      <div className="plot__row-label" style={{gridRow: row}}>
        {pair.label}
        <span className="visually-hidden">
          : {fmt(pair.them)} {unit} per second before, {fmt(pair.us)} after, {ratio.toFixed(1)} times as many.
        </span>
      </div>
      <div className="plot__lane" style={style} aria-hidden="true">
        <span className="plot__line" />
        <span className="plot__dot plot__dot--them">
          <span className="plot__tag">{short(pair.them)}</span>
        </span>
        <span className="plot__dot plot__dot--us">
          <span className="plot__tag">{short(pair.us)}</span>
        </span>
      </div>
      <div className="plot__ratio" style={{gridRow: row, opacity: done}} aria-hidden="true">
        {ratio < 10 ? ratio.toFixed(1) : Math.round(ratio)}×
      </div>
    </>
  );
}

export function PairsPlot({groups}: {groups: Group[]}) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref, {start: 0.95, end: 0.35});
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  let row = 0;
  let index = 0;
  const items: ReactNode[] = [];
  for (const g of groups) {
    row += 1;
    items.push(
      <div key={g.title} className="plot__group" style={{gridRow: row}}>
        <span className="plot__title">{g.title}</span>
        <span className="plot__setting">{g.setting}</span>
      </div>,
      <div key={`${g.title}-per`} className="plot__per" style={{gridRow: row}}>
        × {g.per}
      </div>,
    );
    for (const pair of g.rows) {
      row += 1;
      // Each row starts a little after the one above it.
      const own = clamp((p - (index / total) * 0.4) / 0.6);
      items.push(<Row key={pair.label} pair={pair} p={own} row={row} />);
      index += 1;
    }
  }
  return (
    <div ref={ref} className="plot">
      <div className="plot__grid" style={{gridRow: `1 / ${row + 1}`}} aria-hidden="true">
        {TICKS.map((t) => (
          <span key={t} className="plot__tick" style={{'--at': `${x(t)}%`} as CSSProperties}>
            <span>{short(t)}</span>
          </span>
        ))}
      </div>
      {items}
      <div className="plot__axis" style={{gridRow: row + 1}} aria-hidden="true">
        <span className="plot__legend">
          <span className="plot__key plot__key--them">compared with</span>
          <span className="plot__key plot__key--us">Stroppy</span>
        </span>
        <span>per second, log scale</span>
      </div>
    </div>
  );
}
