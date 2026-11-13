import {share, type CategoryId, type Engine, type PartId, type View} from './score';

export const pct = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
/** A run's value in its own unit: "175,084 tpmC". */
export const speed = (run: {value: number; unit: string}) => `${Math.round(run.value).toLocaleString('en-US')} ${run.unit}`;
const ofBase = (s: number | undefined) => (s === undefined ? '' : ` · ${Math.round(s * 100)}%`);

/** The number a reader knows for a part: "97.4%", "3 breaks", "175,084 tpmC · 89%". */
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
    case 'procs':
    case 'tpch':
    case 'tpcds': {
      const run = e[id];
      return run ? `${speed(run)}${ofBase(share(e, base, id))}` : '';
    }
  }
}

/**
 * The number a category cell leads with, for what its column shows: a run's
 * value alone (its share of the baseline is the cell's bar and score). The
 * compatibility average has none: it is a mean of parts in different units,
 * so only its score stands for it.
 */
export function rawCell(category: CategoryId, view: View, e: Engine, base: Engine | undefined): string {
  const run = (id: 'tx' | 'procs' | 'tpch' | 'tpcds') => {
    const r = e[id];
    return r ? speed(r) : '';
  };
  switch (view) {
    case 'tx':
    case 'procs':
    case 'tpch':
    case 'tpcds':
      return run(view);
    case 'avg':
      break;
    default:
      return rawPart(view, e, base);
  }
  switch (category) {
    case 'compat':
      return '';
    case 'speed':
      return run('tx') || run('procs');
    case 'analytics':
      return run('tpch') || run('tpcds');
  }
}
