import {useId, useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import clsx from 'clsx';
import Icon from '@site/src/components/nav/icons';

// A diagram of blocks in framed groups with drawn links between them, after
// Stroppy Cloud's own (web/src/components/public/Diagram.tsx there). Hover
// or focus lights a block with its links and opens a card next to it: what
// it is and how it works. A step of a story lights a path on its own. Styles
// in src/css/how.css.

export type DiagramFact = {label: string; items: string[]};

export type DiagramNode = {
  id: string;
  icon: string;
  /** Grid area inside its group. */
  area: string;
  title: string;
  body: string;
  /** The hover card: how it works, and where it is in the console. */
  more: string;
  foot?: string;
  /** Runs on the user's side (the console in the browser). */
  client?: boolean;
  /** One concrete value, as a real test would have it. */
  sample?: string;
  facts?: DiagramFact[];
  /** Small chips under the block (what a report leads to). */
  chips?: string[];
};

export type DiagramGroup = {
  id: string;
  label: string;
  icon: string;
  /** Dashed frame: not ours (the tenant's scope, the user's cloud). */
  dashed?: boolean;
  /** What the parts stand on: a quiet row of chips, linked by hidden edges. */
  deps?: DiagramNode[];
  depsLabel?: string;
  columns: number;
  areas: string;
  nodes: DiagramNode[];
};

/** `hidden`: lights on hover and in steps, but is not drawn (a block and what it runs on). */
export type DiagramEdge = {from: string; to: string; label?: string; hidden?: boolean};

/** A path a step of a story lights; hover still wins. */
export type DiagramFocus = {nodes: string[]; edges: string[]};

const CARD_W = 340;

type Box = {x: number; y: number; w: number; h: number};

// A curve from the side of `a` facing `b` to the side of `b` facing `a`, and
// its midpoint; `vertical` runs it top to bottom whatever the sideways distance.
function geometry(a: Box, b: Box, vertical = false) {
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  if (!vertical && Math.abs(bcx - acx) > Math.abs(bcy - acy) * 0.6) {
    const dir = bcx > acx ? 1 : -1;
    const x1 = dir > 0 ? a.x + a.w : a.x;
    const x2 = dir > 0 ? b.x : b.x + b.w;
    const mx = (x1 + x2) / 2;
    const mid = {x: mx, y: (acy + bcy) / 2};
    return {d: `M ${x1} ${acy} C ${mx} ${acy}, ${mx} ${bcy}, ${x2} ${bcy}`, mid, across: true, at: () => mid};
  }
  const dir = bcy > acy ? 1 : -1;
  const y1 = dir > 0 ? a.y + a.h : a.y;
  const y2 = dir > 0 ? b.y : b.y + b.h;
  const my = (y1 + y2) / 2;
  // The point of the curve at height `y` (it moves one way vertically).
  const at = (y: number) => {
    const point = (t: number) => {
      const u = 1 - t;
      return {
        x: u * u * u * acx + 3 * u * u * t * acx + 3 * u * t * t * bcx + t * t * t * bcx,
        y: u * u * u * y1 + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * y2,
      };
    };
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const t = (lo + hi) / 2;
      if ((point(t).y - y) * dir < 0) lo = t;
      else hi = t;
    }
    return point((lo + hi) / 2);
  };
  return {
    d: `M ${acx} ${y1} C ${acx} ${my}, ${bcx} ${my}, ${bcx} ${y2}`,
    mid: {x: (acx + bcx) / 2, y: my},
    across: false,
    at,
  };
}

export default function Diagram({
  groups,
  edges,
  focus,
}: {
  groups: DiagramGroup[];
  edges: DiagramEdge[];
  focus?: DiagramFocus | null;
}) {
  const uid = useId().replace(/:/g, '');
  const root = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [rootW, setRootW] = useState(0);
  const [active, setActive] = useState<string | null>(null);

  // Lines and cards follow the blocks wherever the layout puts them.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const measure = () => {
      const base = el.getBoundingClientRect();
      // A scaled ancestor (a screen fitted to the viewport) scales the
      // measured boxes too; the drawing is in the root's own units.
      const k = el.offsetWidth ? base.width / el.offsetWidth : 1;
      const next: Record<string, Box> = {};
      for (const [id, node] of Object.entries(refs.current)) {
        const r = node?.getBoundingClientRect();
        if (r) next[id] = {x: (r.left - base.left) / k, y: (r.top - base.top) / k, w: r.width / k, h: r.height / k};
      }
      setBoxes(next);
      setRootW(el.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const node of Object.values(refs.current)) if (node) ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const all = groups.flatMap((g) => [...g.nodes, ...(g.deps ?? [])]);
  const groupOf: Record<string, string> = Object.fromEntries(
    groups.flatMap((g) => [...g.nodes, ...(g.deps ?? [])].map((n) => [n.id, g.id])),
  );
  // A link between groups stacked one above the other runs top to bottom and
  // is labelled in the gap between them.
  const stacked = (e: DiagramEdge) => {
    const ga = boxes[`group:${groupOf[e.from]}`];
    const gb = boxes[`group:${groupOf[e.to]}`];
    return !!ga && !!gb && ga !== gb && (ga.y + ga.h <= gb.y || gb.y + gb.h <= ga.y);
  };
  const hoverable = (id: string) => ({
    ref: (el: HTMLElement | null) => {
      refs.current[id] = el;
    },
    'aria-describedby': active === id ? `${uid}-card` : undefined,
    onMouseEnter: () => setActive(id),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(id),
    onBlur: () => setActive(null),
  });
  const linked = (id: string) => {
    if (active !== null)
      return active === id || edges.some((e) => (e.from === active && e.to === id) || (e.to === active && e.from === id));
    return !focus || focus.nodes.includes(id);
  };
  const edgeOn = (e: DiagramEdge) =>
    active !== null ? e.from === active || e.to === active : !!focus?.edges.includes(`${e.from}-${e.to}`);
  const edgeFaded = (e: DiagramEdge) => (active !== null || !!focus) && !edgeOn(e);

  const shown = all.find((n) => n.id === active);
  const box = active ? boxes[active] : undefined;
  // The card sits beside its block: right when there is room, else left.
  const cardLeft = box
    ? box.x + box.w + 12 + CARD_W <= rootW
      ? box.x + box.w + 12
      : Math.max(0, box.x - 12 - CARD_W)
    : 0;

  return (
    <div ref={root} className="dg">
      <svg className="dg__edges" aria-hidden="true">
        <defs>
          <marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
          </marker>
        </defs>
        {edges.map((e) => {
          const a = boxes[e.from];
          const b = boxes[e.to];
          if (e.hidden || !a || !b) return null;
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={geometry(a, b, stacked(e)).d}
              className={clsx('dg__edge', edgeOn(e) && 'is-on', edgeFaded(e) && 'is-faded')}
              markerEnd={`url(#${uid}-arrow)`}
            />
          );
        })}
      </svg>

      {groups.map((g) => (
        <div
          key={g.id}
          ref={(el) => {
            refs.current[`group:${g.id}`] = el;
          }}
          className={clsx('dg__group', g.dashed && 'dg__group--dashed')}>
          <span className="dg__label">
            <Icon name={g.icon} className="dg__label-icon" />
            {g.label}
          </span>
          <div
            className="dg__grid"
            style={{gridTemplateColumns: `repeat(${g.columns}, minmax(0, 1fr))`, gridTemplateAreas: g.areas} as CSSProperties}>
            {g.nodes.map((n) => (
              <button
                type="button"
                key={n.id}
                {...hoverable(n.id)}
                style={{gridArea: n.area}}
                className={clsx(
                  'dg__node',
                  n.client && 'dg__node--client',
                  active === n.id && 'is-active',
                  !linked(n.id) && 'is-dim',
                )}>
                <span className="dg__head">
                  <Icon name={n.icon} className="dg__icon" />
                  {n.title}
                </span>
                <span className="dg__body">{n.body}</span>
                {n.sample && <span className="dg__sample">{n.sample}</span>}
                {n.chips && (
                  <span className="dg__chips">
                    {n.chips.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </span>
                )}
              </button>
            ))}
          </div>
          {g.deps && g.deps.length > 0 && (
            <div className="dg__deps">
              <span className="dg__deps-label">{g.depsLabel}</span>
              {g.deps.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  {...hoverable(n.id)}
                  className={clsx('dg__dep', active === n.id && 'is-active', !linked(n.id) && 'is-dim')}>
                  <Icon name={n.icon} className="dg__icon" />
                  <span className="dg__dep-title">{n.title}</span>
                  {n.sample && <span className="dg__dep-tech">{n.sample}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <svg className="dg__edges dg__edges--labels" aria-hidden="true">
        {edges.map((e) => {
          const a = boxes[e.from];
          const b = boxes[e.to];
          if (e.hidden || !e.label || !a || !b) return null;
          const {mid, across, at} = geometry(a, b, stacked(e));
          // A short sideways link is labelled above its arrow; a link between
          // groups in the gap between them, clear of their contents.
          const ga = boxes[`group:${groupOf[e.from]}`];
          const gb = boxes[`group:${groupOf[e.to]}`];
          let pos = across ? {x: mid.x, y: mid.y - 13} : mid;
          if (stacked(e) && ga && gb) {
            const [upper, lower] = ga.y < gb.y ? [ga, gb] : [gb, ga];
            pos = at((upper.y + upper.h + lower.y) / 2);
          }
          return (
            <g
              key={`${e.from}-${e.to}`}
              transform={`translate(${pos.x} ${pos.y})`}
              className={clsx('dg__edge-label', edgeFaded(e) && 'is-faded')}>
              <rect x={-(e.label.length * 3.1 + 6)} y={-8} width={e.label.length * 6.2 + 12} height={16} rx={4} />
              <text textAnchor="middle" dominantBaseline="central">
                {e.label}
              </text>
            </g>
          );
        })}
      </svg>

      {shown && box && (
        <div id={`${uid}-card`} role="tooltip" className="dg__card" style={{left: cardLeft, top: box.y}}>
          <div className="dg__card-title">
            <Icon name={shown.icon} className="dg__icon" />
            {shown.title}
          </div>
          <p>{shown.more}</p>
          {shown.facts && shown.facts.length > 0 && (
            <div className="dg__facts">
              {shown.facts.map((f) => (
                <div key={f.label}>
                  <div className="dg__fact-label">{f.label}</div>
                  <div className="dg__fact-items">
                    {f.items.map((i) => (
                      <span key={i}>{i}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {shown.foot && <div className="dg__foot">{shown.foot}</div>}
        </div>
      )}
    </div>
  );
}
