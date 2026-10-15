import type {CSSProperties, ReactNode} from 'react';
import clsx from 'clsx';
import mark from '@site/src/kit/mark.json';

// The mark, large and muted, behind the landing's headline. Same motion as
// the Stroppy Cloud landing (web/src/components/landing/HeroMark.tsx there):
// at rest the rays fire one after another like a signal and the band
// breathes; `open` lifts the cylinder's layers apart and throws the rays out,
// as if the database were being opened up for the test.
//
// Here `open` is a number 0…1 that follows the page scroll, set as `--open`;
// every layer derives its offset from it in landing.css.
// Each layer is its own <svg> over the same viewBox, so all motion is opacity
// and transform on separate elements; the tilt is a transform inside the SVG,
// so a large mark stays vector instead of being resampled.

// The drawing area; layers translate in % of it, so units convert exactly.
const VB = {x: 14, y: -2, w: 100, h: 132};
const ux = (u: number) => `${(u / VB.w) * 100}%`;
const uy = (u: number) => `${(u / VB.h) * 100}%`;

// Rays leave from the top of the cylinder.
const ORIGIN = {x: 64, y: 42};
const RAY_CENTRES = [
  [35, 27],
  [47, 22],
  [64, 22],
  [80, 23],
  [92, 27],
] as const;
const RAY_DIRS = RAY_CENTRES.map(([x, y]) => {
  const dx = x - ORIGIN.x;
  const dy = y - ORIGIN.y;
  const len = Math.hypot(dx, dy);
  return [dx / len, dy / len] as const;
});
// Open state: how far each layer travels (drawing units), how far rays fly.
const LIFT = {top: -16, middle: -6, band: 3, bottom: 12};
const THROW = 14;
// Idle: each ray nudges this far out, one after another.
const NUDGE = 2.5;
const WAVE_STEP = 0.18;

const vars = (v: Record<string, string>) => v as CSSProperties;

function Layer({lift, className, children}: {lift: number; className?: string; children: ReactNode}) {
  return (
    <div className={clsx('mark__layer', className)} style={vars({'--lift': uy(lift)})}>
      <svg className="mark__svg" viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid meet">
        <g className="mark__tilt">{children}</g>
      </svg>
    </div>
  );
}

export default function HeroMark({open, className}: {open: number; className?: string}) {
  return (
    <div className={clsx('mark', className)} style={vars({'--open': String(open)})} aria-hidden="true">
      <div className="mark__body">
        <Layer lift={LIFT.top}>
          <path d={mark.body[0]} />
        </Layer>
        <Layer lift={LIFT.middle}>
          <path d={mark.body[1]} />
        </Layer>
        <Layer lift={LIFT.bottom}>
          <path d={mark.body[2]} />
        </Layer>
      </div>
      <div className="mark__breathe">
        <Layer lift={LIFT.band} className="mark__band">
          <path d={mark.band} />
        </Layer>
      </div>
      {mark.rays.map((d, i) => {
        const [dx, dy] = RAY_DIRS[i];
        return (
          <div
            key={d}
            className="mark__ray"
            style={vars({
              '--dx': ux(dx * THROW),
              '--dy': uy(dy * THROW),
              '--nx': ux(dx * NUDGE),
              '--ny': uy(dy * NUDGE),
              '--delay': `${i * WAVE_STEP}s`,
            })}>
            <div className="mark__pulse">
              <svg className="mark__svg" viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid meet">
                <g className="mark__tilt">
                  <path d={d} />
                </g>
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
