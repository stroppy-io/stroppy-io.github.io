// What /ratings shows, all of it in the query string so any view is a link:
// ?proto=mysql&view=forks&tool=Debezium&tool=mysqldump&db=<row id>. A tool is named as
// the export names it and repeated per tool, since tool names carry commas
// and slashes. Defaults are left out of the URL.

/** The page's views: the engines, then what sits beside them. */
export const VIEWS = ['engines', 'speed', 'forks', 'storage', 'held', 'errata'] as const;
export type View = (typeof VIEWS)[number];

export type State = {
  proto: string;
  view: View;
  /** The reader's tools, in the order picked; none means the engines are read by the parts of their score. */
  tools: string[];
  /** The engine opened in place, by its conformity row id. */
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
    db: q.get('db'),
  };
}

export function serialize(s: Partial<State>, protocols: string[]): string {
  const q = new URLSearchParams();
  if (s.proto && s.proto !== defaultProtocol(protocols)) q.set('proto', s.proto);
  if (s.view && s.view !== 'engines') q.set('view', s.view);
  for (const t of s.tools ?? []) q.append('tool', t);
  if (s.db) q.set('db', s.db);
  const out = q.toString();
  return out ? `?${out}` : '';
}
