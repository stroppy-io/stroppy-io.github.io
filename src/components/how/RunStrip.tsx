import type {CSSProperties} from 'react';
import clsx from 'clsx';
import {LIFECYCLE} from './data';

// One run on its own clock: a strip whose stages are as wide as the time
// they take. Typical minutes of a 10-minute TPC-C run on one PostgreSQL
// machine. The page's chapters follow the same clock, so each stage of the
// hero strip links to its chapter. Styles in src/css/how.css (.strip).

export type Stage = {
  /** The chapter this stage links to. */
  id: string;
  title: string;
  body: string;
  min: number;
  /** Minute the stage starts at. */
  at: number;
  color: string;
  /** Where its flag hangs under the strip: row, and which edge it is pinned to. */
  row: 1 | 2;
  edge: 'start' | 'end';
};

const PLAN: Omit<Stage, 'title' | 'body' | 'at'>[] = [
  {id: 'stand', min: 3, color: 'var(--st-series-6)', row: 1, edge: 'start'},
  {id: 'tuning', min: 2, color: 'var(--st-series-4)', row: 2, edge: 'start'},
  {id: 'load', min: 12, color: 'var(--st-primary)', row: 1, edge: 'start'},
  {id: 'share', min: 1, color: 'var(--st-series-3)', row: 1, edge: 'end'},
  {id: 'teardown', min: 1, color: 'var(--st-series-8)', row: 2, edge: 'end'},
];

export const STAGES: Stage[] = PLAN.map((p, i) => ({
  ...p,
  title: LIFECYCLE[i].title,
  body: LIFECYCLE[i].body,
  at: PLAN.slice(0, i).reduce((a, s) => a + s.min, 0),
}));

export const TOTAL = STAGES.reduce((a, s) => a + s.min, 0);

/** "3:00" for minute 3. */
export const clock = (m: number) => `${m}:00`;

const pct = (m: number) => `${(m / TOTAL) * 100}%`;

/** A webhook event at the minutes it fires, its label on a row above the strip. */
export type Pin = {at: number[]; name: string; row: 1 | 2; edge: 'start' | 'end'};

export default function RunStrip({pins, compact}: {pins?: Pin[]; compact?: boolean}) {
  const ticks = Array.from({length: TOTAL + 1}, (_, m) => m);
  return (
    <div className={clsx('strip', compact && 'strip--compact', pins && 'strip--pins')}>
      {pins && (
        <ol className="strip__pins" aria-label="Webhook events along a run">
          {pins.map((p) => {
            const from = Math.min(...p.at);
            const to = Math.max(...p.at);
            return (
              <li
                key={p.name}
                className={clsx('strip__pin', `strip__pin--row${p.row}`, `strip__pin--${p.edge}`)}
                style={{left: pct(from), width: pct(to - from)}}>
                <code>{p.name}</code>
                {p.at.map((m) => (
                  <span key={m} className="strip__stem" style={{left: to > from ? `${((m - from) / (to - from)) * 100}%` : 0}} />
                ))}
              </li>
            );
          })}
        </ol>
      )}
      {!compact && (
        <div className="strip__ruler" aria-hidden="true">
          {ticks.map((m) => (
            <span
              key={m}
              className={clsx('strip__tick', (m % 5 === 0 || m === TOTAL) && 'strip__tick--major')}
              style={{left: pct(m)}}>
              {(m % 5 === 0 || m === TOTAL) && m !== 0 && <b>{m === TOTAL ? `${m} min` : m}</b>}
            </span>
          ))}
        </div>
      )}
      <ol className="strip__bar" style={{gridTemplateColumns: STAGES.map((s) => `${s.min}fr`).join(' ')}}>
        {STAGES.map((s) => (
          <li
            key={s.id}
            className={clsx('strip__stage', `strip__stage--row${s.row}`, `strip__stage--${s.edge}`)}
            style={
              {
                '--c': s.color,
              } as CSSProperties
            }>
            {compact ? (
              <span className="strip__seg" aria-label={`${s.title}, about ${s.min} min`}>
                <span className="strip__fill" />
              </span>
            ) : (
              <a className="strip__seg" href={`#${s.id}`}>
                <span className="strip__fill" />
                <span className="strip__flag">
                  <span className="strip__name">{s.title}</span>
                  <span className="strip__min">
                    <span className="strip__about">about </span>
                    {s.min} min
                  </span>
                </span>
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
