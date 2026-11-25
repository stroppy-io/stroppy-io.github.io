// The public rating of Stroppy Cloud (GET /api/v1/public/rating), as the
// landing reads it: plugins/cloud-rating.ts takes a copy at build time so
// the page renders with numbers, and the browser refreshes it on stroppy.io,
// which the API allows by CORS.

export const CLOUD = 'https://cloud.stroppy.io';

// The board compares like with like: one scenario, one topology, one kind of
// database hardware (machines, CPU platform, disk) and one scale per table
// (groupsOf). Each scenario ranks by its own metric (tpmC for TPC-C, the
// queries' geometric mean time for TPC-H, QphDS for TPC-DS), and the page says
// its unit and which way is better.

/** The scenarios the site shows, in tab order; `key` names one in the build's copy (plugins/cloud-rating.ts). */
export const SCENARIOS = [
  {key: 'tx', scenario: 'tpcc/tx', label: 'TPC-C', scale: (n: number) => `${n} warehouses`},
  {key: 'procs', scenario: 'tpcc/procs', label: 'TPC-C procs', scale: (n: number) => `${n} warehouses`},
  {key: 'tpch', scenario: 'tpch/tx', label: 'TPC-H', scale: (n: number) => `SF${n}`},
  {key: 'tpcds', scenario: 'tpcds', label: 'TPC-DS', scale: (n: number) => `SF${n}`},
] as const;
export type ScenarioKey = (typeof SCENARIOS)[number]['key'];

/** The stand every number on the site is measured on: one database machine, 32 vCPU, 128 GB. */
const STAND = {cpu: 32, memory_gb: 128};
/** The period a configuration's runs are taken from; the landing says "the last 30 days". */
const PERIOD = '30d';
const ratingUrl = (scenario: string) => `${CLOUD}/api/v1/public/rating?scenario=${scenario}&period=${PERIOD}`;

type Machine = {count: number; cpu: number; memory_gb: number; platform?: string; disk_type?: string};

/**
 * One configuration (database, version, topology, workload, scenario,
 * hardware) over the rating's period: `value` is its best run, which
 * `share_token` and `run_at` point at; `median` and `runs` are over all its
 * runs.
 */
export type RatingRow = {
  rank: number;
  value: number;
  median: number;
  runs: number;
  metric: string;
  unit: string;
  db_kind: string;
  db_version: string;
  topology: {nodes: {role: string; engine: string; count: number}[]};
  hardware: {key: string; machines: Machine[]};
  workload_name: string;
  /** The one scale every segment of the workload agrees on; absent when none sets it or they differ. */
  scale_factor?: number;
  scenario: string;
  run_at: string;
  last_run_at: string;
  share_token?: string;
};

/** What a scenario ranks by: its unit and which way is better. */
export type Metric = {key: string; title: string; unit: string; higher_is_better: boolean};

/**
 * What one table ranks: one topology on one kind of database hardware (the
 * database machines, their CPU, their disk) at one scale. Rows that differ in
 * any of these are never ranked together; rows that differ only in the
 * machines beside the database (a proxy, an MPP coordinator) are.
 */
export type Group = {
  /** `<topology>|<hardware>|<scale>`, unique within a scenario. */
  key: string;
  /** How the database stood: "1 node", "3 nodes", "1+2 replicas", "MPP 1+4". */
  topology: string;
  /** The database machines, their platform and disk: groups split on it. */
  hardware: string;
  /** The database machines' CPU, as a reader picks it: "standard" or "compute-optimized". */
  cpu: string;
  /** Their disk, as a reader picks it: "io-m3", "non-replicated". */
  disk: string;
  scaleFactor?: number;
  /** Rated runs behind the group: every default is the choice with the most. */
  runs: number;
  /** Best first, ranked 1..n within the group, one row per database, version and topology. */
  rows: RatingRow[];
};

/**
 * One scenario: every group of its rows, most rated runs first, and its
 * metric. `data` is the single-machine group with the most runs, which
 * /ratings scores engines on.
 */
export type Rating = {data: RatingRow[]; metric: Metric | null; groups: Group[]};

/** The stand alone: one machine of the stand's size, nothing beside it. */
const onStand = ({machines}: RatingRow['hardware']) =>
  machines.length === 1 && machines[0].count === 1 && machines[0].cpu === STAND.cpu && machines[0].memory_gb === STAND.memory_gb;

const sumRuns = (rows: RatingRow[]) => rows.reduce((n, r) => n + r.runs, 0);

/** The database's own machines: the first group of a hardware class; the rest stand beside it. */
const hardwareKey = (row: RatingRow) => {
  const m = row.hardware.machines[0];
  return m ? `${m.count}x${m.cpu}c${m.memory_gb}g:${m.platform ?? ''}:${m.disk_type ?? ''}` : row.hardware.key;
};

/** The rows split by topology, hardware and scale, each ranked within itself; most runs first, the latest run breaking a tie. */
export function groupsOf(all: RatingRow[]): Group[] {
  const byKey = new Map<string, RatingRow[]>();
  for (const r of all) {
    const key = `${topologyName(r)}|${hardwareKey(r)}|${r.scale_factor ?? ''}`;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return [...byKey.entries()]
    .map(([key, rows]): Group => {
      // Best first across the merged classes; a setup listed twice keeps its best row.
      const seen = new Set<string>();
      const unique = [...rows]
        .sort((a, b) => a.rank - b.rank)
        .filter((r) => {
          const id = `${r.db_kind} ${r.db_version} ${topology(r)}`;
          return seen.has(id) ? false : (seen.add(id), true);
        });
      return {
        key,
        topology: topologyName(rows[0]),
        hardware: hardwareKey(rows[0]),
        cpu: cpuOf(rows[0]),
        disk: diskOf(rows[0]),
        scaleFactor: rows[0].scale_factor,
        runs: sumRuns(rows),
        rows: unique.map((r, i) => ({...r, rank: i + 1})),
      };
    })
    .sort((a, b) => b.runs - a.runs || lastRun(b.rows).localeCompare(lastRun(a.rows)));
}

/**
 * A topology's short name, from the database's own nodes: "1 node", "3 nodes",
 * "1+2 replicas", "MPP 1+4". What stood beside them (a proxy, etcd) is in each
 * row's own topology line.
 */
export function topologyName(row: RatingRow): string {
  const count = (role: string) => row.topology.nodes.filter((n) => n.role === role).reduce((a, n) => a + n.count, 0);
  const db = count('db'),
    replicas = count('db-replica');
  if (count('coordinator')) return `MPP 1+${db}`;
  if (replicas) return `1+${replicas} ${replicas === 1 ? 'replica' : 'replicas'}`;
  return db > 1 ? `${db} nodes` : '1 node';
}

/** The database machines' CPU in a word: "standard" or "compute-optimized". */
const cpuOf = (row: RatingRow) => (row.hardware.machines[0]?.platform?.startsWith('highfreq') ? 'compute-optimized' : 'standard');

/** Their disk in a word: "io-m3", "non-replicated". */
function diskOf(row: RatingRow): string {
  const disk = row.hardware.machines[0]?.disk_type;
  return disk ? (DISKS[disk] ?? disk).replace(/ SSD$/, '') : 'any';
}

const ENGINES: Record<string, string> = {
  postgres: 'PostgreSQL',
  orioledb: 'OrioleDB',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  picodata: 'Picodata',
  ydb: 'YDB',
  cockroach: 'CockroachDB',
  greenplum: 'Greenplum',
  greengage: 'Greengage',
  warehousepg: 'WarehousePG',
  opengpdb: 'OpenGPDB',
  cloudberry: 'Cloudberry',
  haproxy: 'HAProxy',
  proxysql: 'ProxySQL',
  pgbouncer: 'PgBouncer',
  odyssey: 'Odyssey',
  patroni: 'Patroni',
  etcd: 'etcd',
};

export const engine = (kind: string) => ENGINES[kind] ?? kind;

/**
 * How the database stood: "single node", "3 nodes · ProxySQL",
 * "primary + 2 replicas · HAProxy · 3× etcd", "coordinator + 4 segment hosts".
 */
export function topology(row: RatingRow): string {
  const count = (role: string) => row.topology.nodes.filter((n) => n.role === role).reduce((a, n) => a + n.count, 0);
  const db = count('db'),
    replicas = count('db-replica');
  const head = count('coordinator')
    ? `coordinator + ${db} segment hosts`
    : db > 1
      ? `${db} nodes`
      : replicas
        ? `primary + ${replicas} ${replicas === 1 ? 'replica' : 'replicas'}`
        : 'single node';
  const extra = row.topology.nodes
    .filter((n) => n.count > 0 && !['db', 'db-replica', 'coordinator', 'runner'].includes(n.role))
    .map((n) => (n.count > 1 ? `${n.count}× ${engine(n.engine)}` : engine(n.engine)));
  return [head, ...extra].join(' · ');
}

const DISKS: Record<string, string> = {
  'network-ssd-nonreplicated': 'non-replicated SSD',
  'network-ssd-io-m3': 'io-m3 SSD',
  'network-ssd': 'SSD',
  'network-hdd': 'HDD',
};

/** Platforms by the CPU behind them, as the cloud's provider catalog names them; the class is a tag of its own. */
const PLATFORMS: Record<string, string[]> = {
  'standard-v1': ['Intel Broadwell'],
  'standard-v2': ['Intel Cascade Lake'],
  'standard-v3': ['Intel Ice Lake'],
  'highfreq-v3': ['Intel Ice Lake', 'compute-optimized'],
  'standard-v4a': ['AMD Zen 4'],
  'highfreq-v4a': ['AMD Zen 4', 'compute-optimized'],
  'amd-v1': ['AMD Zen 3'],
};

/** The database machine as short tags: ["32 vCPU", "128 GB", "Intel Ice Lake", "non-replicated SSD"]. */
export function machineTags(row: RatingRow): string[] {
  const m = row.hardware.machines[0];
  if (!m) return [row.hardware.key];
  return [
    m.count > 1 ? `${m.count} × ${m.cpu} vCPU` : `${m.cpu} vCPU`,
    `${m.memory_gb} GB`,
    ...(m.platform ? (PLATFORMS[m.platform] ?? [m.platform]) : []),
    ...(m.disk_type ? [DISKS[m.disk_type] ?? m.disk_type] : []),
  ];
}

/**
 * What a board ranks by, short: the unit, "lower is better" when it is, and
 * the scale factor for a score named per scale ("QphDS@SF" at scale_factor 10
 * reads "QphDS@SF10").
 */
export function metricLabel(metric: Metric, row: RatingRow): string {
  const sf = row.scale_factor;
  const unit = metric.title.endsWith('@SF') && sf !== undefined ? `${metric.unit}@SF${sf}` : metric.unit;
  return metric.higher_is_better ? unit : `${unit}, lower is better`;
}

/** When the board last changed: the latest run of any of its configurations. */
export const lastRun = (rows: RatingRow[]) => rows.reduce((a, r) => (r.last_run_at > a ? r.last_run_at : a), rows[0]?.last_run_at ?? '');

export const shareUrl = (row: RatingRow) => (row.share_token ? `${CLOUD}/s/${row.share_token}` : `${CLOUD}/leaderboard`);

export async function fetchRating(scenario: string, signal?: AbortSignal): Promise<Rating> {
  const url = ratingUrl(scenario);
  const res = await fetch(url, {signal, headers: {accept: 'application/json'}});
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const page = (await res.json()) as {data: RatingRow[]; metrics?: Metric[]};
  const groups = groupsOf(page.data);
  const data = groups.find((g) => onStand(g.rows[0].hardware))?.rows ?? [];
  const key = groups[0]?.rows[0]?.metric;
  return {data, metric: page.metrics?.find((m) => m.key === key) ?? null, groups};
}
