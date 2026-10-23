import type {Compat, Feature, FeatureCell, Row} from './types';

// Reading the export for /conformity and the landing's teaser: protocol
// names, the five plain states the map shows (from the export's outcome
// codes), feature groups and what a row did in each. Every word about an
// engine comes from the export; this names protocols, states and roles only.

/** Where the export lives on the site; a row's `details` is relative to it. */
export const DATA_BASE = '/data/conformity/';

/** Tabs in this order, PostgreSQL first; a protocol the export adds goes after. */
export const PROTOCOL_ORDER = ['pgwire', 'mysql', 'mongo', 'elastic'];

/** Short names for tabs, and the original engine each protocol is measured against. */
export const PROTOCOLS: Record<string, {short: string; full: string}> = {
  pgwire: {short: 'PostgreSQL', full: 'PostgreSQL wire protocol'},
  mysql: {short: 'MySQL', full: 'MySQL client/server protocol'},
  mongo: {short: 'MongoDB', full: 'MongoDB wire protocol'},
  elastic: {short: 'Elasticsearch', full: 'Elasticsearch REST API'},
};

export const protocolShort = (p: string) => PROTOCOLS[p]?.short ?? p;
export const protocolName = (p: string) => PROTOCOLS[p]?.full ?? p;

export function protocolsOf(c: {rows: {protocol: string}[]}): string[] {
  const rank = (p: string) => (PROTOCOL_ORDER.includes(p) ? PROTOCOL_ORDER.indexOf(p) : PROTOCOL_ORDER.length);
  return [...new Set(c.rows.map((r) => r.protocol))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** "68.2", "100", or an em dash for no score. */
export function percent(v: unknown): string {
  return typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : '—';
}

/** "23 October 2026", in UTC as the export writes it. */
export function day(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
}

/* ---------- The five states ---------- */

export type State = 'same' | 'differs' | 'refused' | 'breaks' | 'none';

/** In legend order, with a glyph each, so no state rests on colour. */
export const STATES: {id: State; glyph: string; label: string; meaning: string}[] = [
  {id: 'same', glyph: '✓', label: 'Works the same', meaning: 'every check matched the original engine'},
  {id: 'differs', glyph: '≠', label: 'Differs', meaning: 'a valid answer that is not the original’s'},
  {id: 'refused', glyph: '∅', label: 'Refused', meaning: 'a clean “not supported” error'},
  {id: 'breaks', glyph: '✕', label: 'Breaks', meaning: 'the session dropped, hung, or the server crashed'},
  {id: 'none', glyph: '·', label: 'Not measured', meaning: 'no check could be judged, or a step before it failed'},
];

export const stateInfo = (s: State) => STATES.find((x) => x.id === s)!;

/** The export's feature-map code (legend.feature_codes) as one of the five states. */
export function stateOfCode(code: number): State {
  if (code === 0) return 'same';
  if (code === 3) return 'refused';
  if (code === 4) return 'differs';
  if (code >= 5) return 'breaks';
  return 'none';
}

/** An outcome name (legend.outcomes) as one of the five states. */
export function stateOfOutcome(outcome: string): State {
  switch (outcome) {
    case 'match':
      return 'same';
    case 'divergent':
      return 'differs';
    case 'unsupported':
      return 'refused';
    case 'disconnect':
    case 'protocol_violation':
    case 'hang':
    case 'unresponsive':
    case 'crash':
      return 'breaks';
    default:
      return 'none';
  }
}

/* ---------- Groups and cells ---------- */

export type Group = {name: string; features: {feature: Feature; k: number}[]};

/** A protocol's feature groups, in map order; `k` indexes the rows' feature_cells. */
export function groupsOf(c: Compat, protocol: string): Group[] {
  const groups: Group[] = [];
  (c.feature_sets[protocol] ?? []).forEach((i, k) => {
    const feature = c.features[i];
    const last = groups[groups.length - 1];
    if (last && last.name === feature.group) last.features.push({feature, k});
    else groups.push({name: feature.group, features: [{feature, k}]});
  });
  return groups;
}

/** What a map cell shows: the worst code over its checks and how many matched. */
export type Cell = {code: number; matched: number; total: number} | null;

export function cellOf(fc: FeatureCell): Cell {
  return fc ? {code: fc[0], matched: fc[1], total: fc[2]} : null;
}

/** A group's cell: the worst code of its features, matched and total summed. */
export function groupCell(row: Row, g: Group): Cell {
  let out: Cell = null;
  for (const {k} of g.features) {
    const c = cellOf(row.feature_cells[k]);
    if (!c) continue;
    out = out ? {code: Math.max(out.code, c.code), matched: out.matched + c.matched, total: out.total + c.total} : {...c};
  }
  return out;
}

/** References first, then the subjects best first; no score last. */
export function rowsOf(c: Compat, protocol: string): {refs: Row[]; subjects: Row[]} {
  const rows = c.rows.filter((r) => r.protocol === protocol);
  const score = (r: Row) => (typeof r.scores.overall === 'number' ? r.scores.overall : -1);
  return {
    refs: rows.filter((r) => r.role === 'reference'),
    subjects: rows.filter((r) => r.role !== 'reference').sort((a, b) => score(b) - score(a)),
  };
}

/** The roles that carry a score, in the order the drawer shows them. */
export const SCORED_ROLES = ['frames', 'types', 'bulk', 'upstream', 'corpus', 'catalog'];

/** A group's column label: "Types: numbers" is "Numbers" under a "Types" band. */
export function shortGroup(name: string): string {
  const m = /^Types: (.*)$/.exec(name);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : name;
}

/** The band a group's column sits under ("Types"), or none. */
export const bandOf = (name: string) => (name.startsWith('Types: ') ? 'Types' : '');

/** Consecutive columns under the same band, for the row above the headers. */
export function bands(names: string[]): {label: string; span: number}[] {
  const out: {label: string; span: number}[] = [];
  for (const n of names) {
    const label = bandOf(n);
    const last = out[out.length - 1];
    if (last && label && last.label === label) last.span += 1;
    else out.push({label, span: 1});
  }
  return out;
}

/** The references as one row: their worst outcome per column, counts summed. */
export function mergeCells(cells: Cell[]): Cell {
  return cells.reduce<Cell>(
    (a, c) => (!c ? a : !a ? {...c} : {code: Math.max(a.code, c.code), matched: a.matched + c.matched, total: a.total + c.total}),
    null,
  );
}
