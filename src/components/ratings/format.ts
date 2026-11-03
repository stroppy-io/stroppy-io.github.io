import {share, type Engine, type PartId, type View} from './score';

export const pct = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
export const tps = (v: number) => Math.round(v).toLocaleString('en-US');
const ofBase = (s: number | undefined) => (s === undefined ? '' : ` · ${Math.round(s * 100)}%`);

/** The number a reader knows for a part: "97.4%", "3 breaks", "4,850 tps · 89%". */
export function rawPart(id: PartId, e: Engine, base: Engine | undefined): string {
  switch (id) {
    case 'frames':
    case 'types':
    case 'bulk': {
      const v = e.conf?.[id];
      return typeof v === 'number' ? pct(v) : '';
    }
    case 'stab':
      return e.breaks ? `${e.breaks} ${e.breaks === 1 ? 'break' : 'breaks'}` : 'nothing broke';
    case 'tx':
    case 'procs': {
      const run = e[id];
      return run ? `${tps(run.value)} tps${ofBase(share(e, base, id))}` : '';
    }
  }
}

/**
 * The number a category cell leads with, for what its column shows. The
 * compatibility average has none: it is a mean of parts in different units,
 * so only its score stands for it.
 */
export function rawCell(category: 'compat' | 'speed', view: View, e: Engine, base: Engine | undefined): string {
  if (view !== 'avg') return rawPart(view, e, base);
  if (category === 'compat') return '';
  return e.tx ? rawPart('tx', e, base) : rawPart('procs', e, base);
}
