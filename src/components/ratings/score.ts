import type {Compat, Row} from '../conformity/types';
import type {CloudRating} from '../../../plugins/cloud-rating';
import type {Rating, RatingRow} from '../landing/rating';

// How /ratings reads the data: one engine per conformity row, joined with its
// runs from Stroppy Cloud (TPC-C, and TPC-H and TPC-DS on the single
// machine), then scored out of 10. Every score is a
// plain conversion of one measure, written next to it on the page; nothing
// is weighed by hand. The baseline is the original a protocol is measured
// against, so it scores 10 by definition.

/** What an engine is built for, so a rating compares like with like. */
export type Kind = 'oltp' | 'analytics' | 'search' | 'proxy';

/** In the order the filter lists them. */
export const KINDS: Kind[] = ['oltp', 'analytics', 'search', 'proxy'];

export const KIND_LABELS: Record<Kind, string> = {
  oltp: 'Transactional',
  analytics: 'Analytical',
  search: 'Search',
  proxy: 'Proxies and poolers',
};

// Neither export says what an engine is for: this is the site's call, by
// what each engine's own documentation leads with. HTAP engines that lead
// with transactions (TiDB, OceanBase, MatrixOne) count as transactional.
const ENGINE_KIND: Record<string, Kind> = {
  'alloydb-omni': 'oltp',
  arcadedb: 'oltp',
  cockroachdb: 'oltp',
  dolt: 'oltp',
  doltgres: 'oltp',
  immudb: 'oltp',
  mariadb: 'oltp',
  matrixone: 'oltp',
  mysql: 'oltp',
  oceanbase: 'oltp',
  orioledb: 'oltp',
  'percona-server': 'oltp',
  picodata: 'oltp',
  postgresql: 'oltp',
  spanner: 'oltp',
  tidb: 'oltp',
  ydb: 'oltp',
  yugabytedb: 'oltp',
  mongodb: 'oltp',
  'percona-server-mongodb': 'oltp',
  ferretdb: 'oltp',
  documentdb: 'oltp',
  cedardb: 'analytics',
  clickhouse: 'analytics',
  cloudberry: 'analytics',
  cratedb: 'analytics',
  databend: 'analytics',
  doris: 'analytics',
  duckdb: 'analytics',
  greptimedb: 'analytics',
  materialize: 'analytics',
  questdb: 'analytics',
  risingwave: 'analytics',
  serenedb: 'analytics',
  starrocks: 'analytics',
  elasticsearch: 'search',
  opensearch: 'search',
  easysearch: 'search',
  quickwit: 'search',
  zincsearch: 'search',
  manticore: 'search',
  pgbouncer: 'proxy',
  vitess: 'proxy',
};

export type Engine = {
  id: string;
  name: string;
  protocol: string;
  kind?: Kind;
  /** The original of its protocol, or an engine that claims to speak it. */
  original: boolean;
  version: string;
  /** Conformity scores in percent, by suite; absent when it was not run. */
  conf?: {overall: number | null; frames: number | null; types: number | null; bulk: number | null};
  /** Crashes, hangs, unresponsive sessions and broken protocol messages during the conformity checks. */
  breaks?: number;
  findings: string[];
  tx?: Run;
  procs?: Run;
  tpch?: Run;
  tpcds?: Run;
};

/** The scenarios an engine is scored on, by the key the build's copy uses. */
export type RunKey = 'tx' | 'procs' | 'tpch' | 'tpcds';
const RUN_KEYS: RunKey[] = ['tx', 'procs', 'tpch', 'tpcds'];

/** A rating row and which way its metric is better (TPC-C tpmC up, query times down). */
export type Run = RatingRow & {higher: boolean};

// Stroppy Cloud's db_kind as conformity knows it: the protocol it speaks, the
// conformity export's engine name, and a display name for a run with no
// conformity row. The two exports name engines independently.
const DB_KINDS: Record<string, {protocol: string; engine: string; name: string}> = {
  postgres: {protocol: 'pgwire', engine: 'postgresql', name: 'PostgreSQL'},
  orioledb: {protocol: 'pgwire', engine: 'orioledb', name: 'OrioleDB'},
  mysql: {protocol: 'mysql', engine: 'mysql', name: 'MySQL'},
  mariadb: {protocol: 'mysql', engine: 'mariadb', name: 'MariaDB'},
};

const num = (v: number | null | undefined): number | null => (typeof v === 'number' ? v : null);
const breaksOf = (r: Row) => r.severe.crash + r.severe.hang + r.severe.unresponsive + r.severe.protocol_violation;
/** "18" matches "18.6 (Debian …)", "11.8" matches "11.8.9-MariaDB"; "8.4" does not match "8.0.46". */
const sameVersion = (claims: string, version: string) =>
  claims === version || claims.startsWith(`${version}.`) || claims.startsWith(`${version} `);

/** Conformity rows and rating runs as engines; a run with no conformity row is an engine of its own. */
export function engines(compat: Compat, ratings: CloudRating): Engine[] {
  const out: Engine[] = compat.rows
    .filter((r) => r.role !== 'control' && !r.variant)
    .map((r) => ({
      id: r.id,
      name: r.target,
      protocol: r.protocol,
      kind: ENGINE_KIND[r.engine],
      original: r.role === 'reference',
      version: r.claims,
      conf: {overall: num(r.scores.overall), frames: num(r.scores.frames), types: num(r.scores.types), bulk: num(r.scores.bulk)},
      breaks: breaksOf(r),
      findings: r.top_findings.map((f) => f.summary),
    }));
  const attach = (rating: Rating | null, key: RunKey) => {
    const higher = rating?.metric?.higher_is_better !== false;
    for (const run of rating?.data ?? []) {
      const kind = DB_KINDS[run.db_kind];
      if (!kind) continue;
      const {protocol} = kind;
      let e = out.find(
        (x) =>
          x.protocol === protocol &&
          compat.rows.some((r) => r.id === x.id && r.engine === kind.engine && sameVersion(r.claims, run.db_version)),
      );
      if (!e) e = out.find((x) => x.id === `${run.db_kind}-${run.db_version}-run`);
      if (!e) {
        e = {
          id: `${run.db_kind}-${run.db_version}-run`,
          name: `${kind.name} ${run.db_version}`,
          protocol,
          kind: ENGINE_KIND[kind.engine],
          original: false,
          version: run.db_version,
          findings: [],
        };
        out.push(e);
      }
      e[key] = {...run, higher};
    }
  };
  for (const key of RUN_KEYS) attach(ratings[key], key);
  return out;
}

/** The original every engine of a protocol is compared with: the version that has a TPC-C run, else the newest. */
export function baseline(all: Engine[], protocol: string): Engine | undefined {
  const originals = all.filter((e) => e.protocol === protocol && e.original);
  return originals.find((e) => e.tx) ?? [...originals].sort((a, b) => b.name.localeCompare(a.name, undefined, {numeric: true}))[0];
}

/* ---------- parts and categories ---------- */

export type PartId = 'frames' | 'types' | 'bulk' | 'stab' | RunKey;
export type CategoryId = 'compat' | 'speed' | 'analytics';
/** What a category column shows: the mean of its parts, or one of them. */
export type View = 'avg' | PartId;

export type Part = {id: PartId; category: CategoryId; label: string; how: string};

export const PARTS: Part[] = [
  {id: 'frames', category: 'compat', label: 'Protocol', how: '% of protocol checks that behave like the original, ÷ 10'},
  {id: 'types', category: 'compat', label: 'Types', how: '% of data-type checks that behave like the original, ÷ 10'},
  {id: 'bulk', category: 'compat', label: 'Bulk load', how: '% of bulk-load checks that behave like the original, ÷ 10'},
  {id: 'stab', category: 'compat', label: 'Stability', how: '10, minus 2 per crash, hang or broken message'},
  {id: 'tx', category: 'speed', label: 'TPC-C', how: 'TPC-C tpmC as a share of the baseline’s, × 10; as fast or faster is 10'},
  {id: 'procs', category: 'speed', label: 'Procedures', how: 'TPC-C with stored procedures, as a share of the baseline’s, × 10'},
  {
    id: 'tpch',
    category: 'analytics',
    label: 'TPC-H',
    how: 'the baseline’s TPC-H query time (geometric mean) ÷ the engine’s, × 10; as fast or faster is 10',
  },
  {id: 'tpcds', category: 'analytics', label: 'TPC-DS', how: 'the same for TPC-DS'},
];

export type Category = {id: CategoryId; label: string; how: string; parts: Part[]};

const categoryOf = (id: CategoryId, label: string, how: string): Category => ({
  id,
  label,
  how,
  parts: PARTS.filter((p) => p.category === id),
});

export const CATEGORIES: Category[] = [
  categoryOf('compat', 'Compatibility', 'the mean of protocol, types, bulk load and stability'),
  categoryOf('speed', 'Speed', 'the mean of TPC-C and TPC-C with procedures, against the baseline'),
  categoryOf(
    'analytics',
    'Analytics',
    'relative query speed on TPC-H and TPC-DS against the baseline on the same machine; not a TPC score',
  ),
];

export const r1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => r1(xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * A run against the baseline's run of the same scenario, as a speed ratio:
 * the engine's tpmC over the baseline's, or the baseline's query time over
 * the engine's. Undefined when either has no run: no fallback baseline.
 */
export function share(e: Engine, base: Engine | undefined, key: RunKey): number | undefined {
  const mine = e[key],
    theirs = base?.[key];
  if (!mine || !theirs || !mine.value || !theirs.value) return undefined;
  return mine.higher ? mine.value / theirs.value : theirs.value / mine.value;
}

/** A part out of 10, or undefined when it was not run. */
export function part(id: PartId, e: Engine, base: Engine | undefined): number | undefined {
  switch (id) {
    case 'frames':
    case 'types':
    case 'bulk': {
      const v = e.conf?.[id];
      return typeof v === 'number' ? r1(v / 10) : undefined;
    }
    case 'stab':
      return e.breaks === undefined ? undefined : Math.max(0, 10 - 2 * e.breaks);
    case 'tx':
    case 'procs':
    case 'tpch':
    case 'tpcds': {
      const s = share(e, base, id);
      return s === undefined ? undefined : r1(Math.min(10, s * 10));
    }
  }
}

/** The mean of a category's parts that were run. */
export function average(c: Category, e: Engine, base: Engine | undefined): number | undefined {
  const s = c.parts.map((p) => part(p.id, e, base)).filter((v): v is number => v !== undefined);
  return s.length ? mean(s) : undefined;
}

export function category(c: Category, e: Engine, base: Engine | undefined, view: View): number | undefined {
  return view === 'avg' ? average(c, e, base) : part(view, e, base);
}

export type Score = {value: number; of: number; measured: number};

/** The mean of the categories that were run, as the columns show them. */
export function score(e: Engine, base: Engine | undefined, views: Record<CategoryId, View>): Score | null {
  const s = CATEGORIES.map((c) => category(c, e, base, views[c.id])).filter((v): v is number => v !== undefined);
  return s.length ? {value: mean(s), of: CATEGORIES.length, measured: s.length} : null;
}

export const AVERAGES: Record<CategoryId, View> = {compat: 'avg', speed: 'avg', analytics: 'avg'};

/* ---------- picks ---------- */

export type PickId = 'top' | 'runner' | 'fast' | 'warn';

/** A top pick or runner-up scores at least this: no "best" among poor ones. */
export const PICK_MIN = 8;
export type Pick = {id: PickId; title: string; rule: string};

export const PICKS: Pick[] = [
  {
    id: 'top',
    title: 'Top pick',
    rule: `the highest score among alternatives that score ${PICK_MIN.toFixed(1)} or more, with compatibility measured and nothing broken`,
  },
  {id: 'runner', title: 'Runner-up', rule: 'second by the same rule'},
  {id: 'fast', title: 'Fastest', rule: 'the highest TPC-C tpmC among alternatives'},
  {id: 'warn', title: 'Watch out', rule: 'the most crashes, hangs and broken messages'},
];

/**
 * Who wins each pick for a protocol among engines of one kind (or all), on
 * the averages, so a reader's column choice does not move them.
 */
export function winners(all: Engine[], protocol: string, kind: Kind | null): Record<PickId, Engine | undefined> {
  const base = baseline(all, protocol);
  const alts = all.filter((e) => e.protocol === protocol && !e.original && (kind === null || e.kind === kind));
  const s = (e: Engine) => score(e, base, AVERAGES);
  const ranked = alts
    .filter((e) => e.breaks === 0 && average(CATEGORIES[0], e, base) !== undefined && (s(e)?.value ?? 0) >= PICK_MIN)
    .sort(
      (a, b) => (s(b)?.value ?? 0) - (s(a)?.value ?? 0) || (s(b)?.measured ?? 0) - (s(a)?.measured ?? 0) || a.name.localeCompare(b.name),
    );
  return {
    top: ranked[0],
    runner: ranked[1],
    fast: alts.filter((e) => e.tx).sort((a, b) => (b.tx?.value ?? 0) - (a.tx?.value ?? 0))[0],
    warn: alts.filter((e) => (e.breaks ?? 0) > 0).sort((a, b) => (b.breaks ?? 0) - (a.breaks ?? 0))[0],
  };
}
