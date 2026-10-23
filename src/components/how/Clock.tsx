import type {CSSProperties} from 'react';
import {STAGES, TOTAL} from './RunStrip';

// The run's clock, pinned under the navbar while the chapters scroll past:
// the minute the page is at, its stage, a track with a playhead, and the
// webhooks the run has sent by then. The page (src/pages/how.tsx) drives it
// from the scroll position through `--t` and the text of the readouts; it
// shows once it sticks under the navbar. Styles in src/css/how.css.

/** The minutes a run sends a webhook at, and the event. */
export const HOOKS: {at: number; name: string}[] = [
  {at: 0, name: 'run.started'},
  ...STAGES.slice(1).map((s) => ({at: s.at, name: 'run.stage'})),
  {at: TOTAL, name: 'run.finished'},
];

/** "4:07" for 4.12 minutes. */
export function clockText(t: number) {
  const m = Math.floor(t + 1e-6);
  const s = Math.min(59, Math.floor((t - m) * 60 + 1e-6));
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Clock() {
  return (
    <nav className="how-clock" aria-label="Stages of the run">
      <div className="how-clock__inner">
        <span className="how-clock__time" aria-hidden="true">
          0:00
        </span>
        <span className="how-clock__stage" aria-hidden="true">
          Before launch
        </span>
        <div className="how-clock__track">
          {STAGES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="how-clock__seg"
              aria-label={`${s.title}, about ${s.min} min`}
              style={{'--c': s.color, '--at': s.at, '--min': s.min, flexGrow: s.min} as CSSProperties}>
              <span className="how-clock__fill" />
            </a>
          ))}
          {HOOKS.map((h) => (
            <span
              key={`${h.name}-${h.at}`}
              className="how-clock__hook"
              data-at={h.at}
              style={{left: `${(h.at / TOTAL) * 100}%`}}
            />
          ))}
          <span className="how-clock__head" />
        </div>
        <span className="how-clock__event" aria-hidden="true">
          <span>Last webhook</span>
          <code>none yet</code>
        </span>
      </div>
    </nav>
  );
}
