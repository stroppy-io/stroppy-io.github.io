// What /ratings shows, all of it in the query string so any view is a link:
// ?proto=mysql&view=speed&tool=Debezium&tool=mysqldump&q=maria&sort=tpcc&dir=asc&db=<row id>.
// A tool is named as the export names it and repeated per tool, since tool
// names carry commas and slashes. Defaults are left out of the URL.

/** What the engines are measured by: compatibility or benchmarks. */
export const VIEWS = ['engines', 'speed'] as const;
export type View = (typeof VIEWS)[number];

export type State = {
  proto: string;
  view: View;
  /** The reader's tools, in the order picked. */
  tools: string[];
  /** Engines whose name holds this, case aside. */
  q: string;
  /** The column the table is sorted by; null keeps its own order (what the engine means for the tools, then the score). */
  sort: string | null;
  dir: 'asc' | 'desc';
  /** The engine open in the side panel, by its conformity row id. */
  db: string | null;
};

export const defaultProtocol = (protocols: string[]) => (protocols.includes('pgwire') ? 'pgwire' : protocols[0]);

export function parse(search: string, protocols: string[]): State {
  const q = new URLSearchParams(search);
  const proto = q.get('proto');
  return {
    proto: proto && protocols.includes(proto) ? proto : defaultProtocol(protocols),
    view: VIEWS.find((v) => v === q.get('view')) ?? 'engines',
    tools: [...new Set(q.getAll('tool'))],
    q: q.get('q') ?? '',
    sort: q.get('sort'),
    dir: q.get('dir') === 'asc' ? 'asc' : 'desc',
    db: q.get('db'),
  };
}

export function serialize(s: Partial<State>, protocols: string[]): string {
  const q = new URLSearchParams();
  if (s.proto && s.proto !== defaultProtocol(protocols)) q.set('proto', s.proto);
  if (s.view && s.view !== 'engines') q.set('view', s.view);
  for (const t of s.tools ?? []) q.append('tool', t);
  if (s.q) q.set('q', s.q);
  if (s.sort) {
    q.set('sort', s.sort);
    if (s.dir === 'asc') q.set('dir', 'asc');
  }
  if (s.db) q.set('db', s.db);
  const out = q.toString();
  return out ? `?${out}` : '';
}
