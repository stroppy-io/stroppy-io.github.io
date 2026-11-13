import {AVERAGES, CATEGORIES, KINDS, PARTS, type CategoryId, type Kind, type View} from './score';

// What /ratings shows, all of it in the query string so any view is a link:
// ?proto=mysql&kind=oltp&sort=speed&dir=asc&compat=types&speed=tx&min=8&clean&bench&refs&db=<engine id>.
// Defaults are left out of the URL.

export type Sort = 'score' | CategoryId;

export type State = {
  proto: string;
  /** Only engines of this kind, picks included; null for every kind. */
  kind: Kind | null;
  sort: Sort;
  /** -1: best first. */
  dir: 1 | -1;
  view: Record<CategoryId, View>;
  /** Compatibility (the average) at least this, 0 for any. */
  min: number;
  /** Only engines where nothing broke. */
  clean: boolean;
  /** Only engines with a TPC-C run. */
  bench: boolean;
  /** Show every version of the original, not only the baseline. */
  refs: boolean;
  db: string | null;
};

export const MIN_OPTIONS = [0, 5, 8, 9];

const SORTS: Sort[] = ['score', ...CATEGORIES.map((c) => c.id)];

const isView = (c: CategoryId, v: string | null): v is View => v === 'avg' || PARTS.some((p) => p.category === c && p.id === v);

export function defaults(protocols: string[]): State {
  return {
    proto: protocols.includes('pgwire') ? 'pgwire' : protocols[0],
    kind: null,
    sort: 'score',
    dir: -1,
    view: {...AVERAGES},
    min: 0,
    clean: false,
    bench: false,
    refs: false,
    db: null,
  };
}

export function parse(search: string, protocols: string[]): State {
  const q = new URLSearchParams(search);
  const d = defaults(protocols);
  const proto = q.get('proto');
  const sort = SORTS.find((s) => s === q.get('sort'));
  const min = Number(q.get('min'));
  const view = {...d.view};
  for (const c of CATEGORIES) {
    const v = q.get(c.id);
    if (isView(c.id, v)) view[c.id] = v;
  }
  return {
    proto: proto && protocols.includes(proto) ? proto : d.proto,
    kind: KINDS.find((k) => k === q.get('kind')) ?? null,
    sort: sort ?? d.sort,
    dir: q.get('dir') === 'asc' ? 1 : -1,
    view,
    min: MIN_OPTIONS.includes(min) ? min : 0,
    clean: q.has('clean'),
    bench: q.has('bench'),
    refs: q.has('refs'),
    db: q.get('db'),
  };
}

export function serialize(s: State, protocols: string[]): string {
  const d = defaults(protocols);
  const q = new URLSearchParams();
  if (s.proto !== d.proto) q.set('proto', s.proto);
  if (s.kind) q.set('kind', s.kind);
  if (s.sort !== d.sort) q.set('sort', s.sort);
  if (s.dir !== d.dir) q.set('dir', 'asc');
  for (const c of CATEGORIES) if (s.view[c.id] !== 'avg') q.set(c.id, s.view[c.id]);
  if (s.min) q.set('min', String(s.min));
  if (s.clean) q.set('clean', '');
  if (s.bench) q.set('bench', '');
  if (s.refs) q.set('refs', '');
  if (s.db) q.set('db', s.db);
  const out = q.toString().replace(/=(?=&|$)/g, '');
  return out ? `?${out}` : '';
}
