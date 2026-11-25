import type {CloudRating} from '../../../plugins/cloud-rating';
import {SCENARIOS, type RatingRow} from '../landing/rating';
import {stateOfCode, type State} from '../conformity/data';
import type {Compat, Legend, Row} from '../conformity/types';

// How /ratings reads the conformity export: for a protocol, every engine that
// claims it, and how each answers the features a reader's own tools rely on.
// A tool is a client the export lists with the features it uses
// (compat.clients); on an engine it is how many of those features answered
// exactly like the original, and the worst state among the rest. Nothing
// here weighs anything by hand: a verdict is the worst state, a score is the
// export's own.

/** A client or tool of a protocol, with the positions of its features in a row's feature_cells. */
export type Tool = {name: string; ks: number[]};

/** The tools of a protocol by name, A to Z; a tool listed twice keeps the union of its features. */
export function toolsOf(c: Compat, protocol: string): Tool[] {
  const set = c.feature_sets[protocol] ?? [];
  const byName = new Map<string, Set<number>>();
  for (const need of c.clients[protocol] ?? []) {
    const ks = byName.get(need.client) ?? new Set<number>();
    for (const f of need.features) {
      const k = set.indexOf(f);
      if (k >= 0) ks.add(k);
    }
    byName.set(need.client, ks);
  }
  return [...byName]
    .map(([name, ks]) => ({name, ks: [...ks].sort((a, b) => a - b)}))
    .filter((t) => t.ks.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'}));
}

/** A tool on an engine: of the tool's features measured there, how many answered like the original, and the worst state. */
export type ToolFit = {state: State; same: number; of: number};

export function toolFit(legend: Legend, row: Row, tool: Tool): ToolFit {
  let worst = -1,
    same = 0,
    of = 0;
  for (const k of tool.ks) {
    const fc = row.feature_cells[k];
    if (!fc) continue;
    const state = stateOfCode(legend, fc[0]);
    if (state === 'none') continue;
    of += 1;
    if (state === 'same') same += 1;
    worst = Math.max(worst, fc[0]);
  }
  return {state: worst < 0 ? 'none' : stateOfCode(legend, worst), same, of};
}

/** The share of the picked tools' features that answered like the original, all tools together. */
export const fitShare = (fits: ToolFit[]) => {
  const of = fits.reduce((n, f) => n + f.of, 0);
  return of ? fits.reduce((n, f) => n + f.same, 0) / of : 0;
};

/** What an engine means for a reader's tools, worst first: the bands the page groups engines into. */
export type Band = 'same' | 'differs' | 'breaks' | 'unknown';

export const BANDS: Band[] = ['same', 'differs', 'breaks', 'unknown'];

/** The band of an engine over some states: any break breaks; any difference or refusal differs; all alike is the same. */
export function bandOf(states: State[]): Band {
  const known = states.filter((s) => s !== 'none');
  if (known.length === 0) return 'unknown';
  if (known.includes('breaks')) return 'breaks';
  if (known.some((s) => s === 'differs' || s === 'refused')) return 'differs';
  return 'same';
}

/** The engines that claim a protocol, as the export publishes them: not its references, best overall score first. */
export function subjectsOf(c: Compat, protocol: string): Row[] {
  const score = (r: Row) => (typeof r.scores.overall === 'number' ? r.scores.overall : -1);
  return c.rows
    .filter((r) => r.protocol === protocol && r.role === 'subject')
    .sort((a, b) => score(b) - score(a) || a.target.localeCompare(b.target));
}

/** Crashes, hangs, unresponsive sessions and broken protocol messages during the checks. */
export const breaksOf = (r: Row) => r.severe.crash + r.severe.hang + r.severe.unresponsive + r.severe.protocol_violation;

/* ---------- speed, from Stroppy Cloud's public rating ---------- */

// Stroppy Cloud's db_kind as conformity names the engine. The two exports
// name engines independently; a run joins a conformity row by engine and
// version.
const DB_KINDS: Record<string, string> = {
  postgres: 'postgresql',
  orioledb: 'orioledb',
  mysql: 'mysql',
  mariadb: 'mariadb',
  picodata: 'picodata',
  ydb: 'ydb',
  cockroach: 'cockroachdb',
  greenplum: 'greenplum',
  greengage: 'greengage',
  warehousepg: 'warehousepg',
  opengpdb: 'opengpdb',
  cloudberry: 'cloudberry',
};

/** "18" matches "18.6 (Debian …)", "11.8" matches "11.8.9-MariaDB"; "8.4" does not match "8.0.46". */
const sameVersion = (claims: string, version: string) =>
  claims === version || claims.startsWith(`${version}.`) || claims.startsWith(`${version} `) || claims.startsWith(`${version}-`);

/** A run's version is the engine's when it matches what the server reports or the product's own version. */
const versionOf = (row: Row, version: string) => sameVersion(row.claims, version) || sameVersion(row.builds?.sut?.claimed ?? '', version);

/** An engine's run in one workload: the best of its configuration on the topology with the most runs. */
export type EngineRun = {label: string; run: RatingRow; topology: string; higher: boolean};

/** Every workload Stroppy Cloud ran an engine in, for its engine and version, in the board's workload order. */
export function runsOf(row: Row, ratings: CloudRating): EngineRun[] {
  const out: EngineRun[] = [];
  for (const s of SCENARIOS) {
    for (const g of ratings[s.key]?.groups ?? []) {
      const run = g.rows.find((r) => DB_KINDS[r.db_kind] === row.engine && versionOf(row, r.db_version));
      if (run) {
        out.push({label: s.label, run, topology: g.topology, higher: ratings[s.key]?.metric?.higher_is_better !== false});
        break;
      }
    }
  }
  return out;
}

/** The original's own TPC-C run on the single machine, the one an engine's TPC-C is read against. */
export function originalTpcc(c: Compat, protocol: string, ratings: CloudRating): RatingRow | undefined {
  const engines = new Set(c.rows.filter((r) => r.protocol === protocol && r.role === 'reference').map((r) => r.engine));
  return ratings.tx?.data.find((run) => engines.has(DB_KINDS[run.db_kind] ?? ''));
}
