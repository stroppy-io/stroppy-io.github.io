// The public rating of Stroppy Cloud (GET /api/v1/public/rating), as the
// landing reads it: plugins/cloud-rating.ts takes a copy at build time so
// the page renders with numbers, and the browser refreshes it on stroppy.io,
// which the API allows by CORS.

export const CLOUD = 'https://cloud.stroppy.io';

// The board compares like with like: one scenario, on one stand, a single
// 32-core node. A hardware class also names the platform and the data disk
// ("1x32c128g:standard-v3:network-ssd-nonreplicated"), which change when the
// runs move; per scenario the board takes the stand's class with the most
// rated runs, the latest run breaking a tie. Each scenario ranks by its
// own metric (tpmC for TPC-C, the queries' geometric mean time for TPC-H and
// TPC-DS), and the page says its unit and which way is better.

/** The scenarios the site shows, in tab order; `key` names one in the build's copy (plugins/cloud-rating.ts). */
export const SCENARIOS = [
  {key: 'tx', scenario: 'tpcc/tx', label: 'TPC-C'},
  {key: 'procs', scenario: 'tpcc/procs', label: 'TPC-C procedures'},
  {key: 'tpch', scenario: 'tpch/tx', label: 'TPC-H'},
  {key: 'tpcds', scenario: 'tpcds', label: 'TPC-DS'},
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
  scenario: string;
  run_at: string;
  last_run_at: string;
  share_token?: string;
};

/** What a scenario ranks by: its unit and which way is better. */
export type Metric = {key: string; title: string; unit: string; higher_is_better: boolean};

/**
 * One scenario: its rows on the single-machine stand, best first, its metric,
 * and apart from them its rows on a cluster (several machines: nodes,
 * replicas, a proxy, MPP segment hosts), which are never ranked with a single
 * machine.
 */
export type Rating = {data: RatingRow[]; metric: Metric | null; clusters: RatingRow[]};

/** The stand alone: one machine of the stand's size, nothing beside it. */
const onStand = ({machines}: RatingRow['hardware']) =>
  machines.length === 1 && machines[0].count === 1 && machines[0].cpu === STAND.cpu && machines[0].memory_gb === STAND.memory_gb;

/**
 * Of the rows given, the hardware class with the most rated runs (the cloud's
 * board picks its default class the same way, so both show the same hardware),
 * the latest run breaking a tie; ranked within it, in the API's order.
 */
function topClass(rows: RatingRow[]): RatingRow[] {
  const classes = new Map<string, RatingRow[]>();
  for (const r of rows) classes.set(r.hardware.key, [...(classes.get(r.hardware.key) ?? []), r]);
  const runs = (rs: RatingRow[]) => rs.reduce((n, r) => n + r.runs, 0);
  const [chosen] = [...classes.values()].sort((a, b) => runs(b) - runs(a) || lastRun(b).localeCompare(lastRun(a)));
  // One row per database, version and topology: the API can list a setup
  // twice (another workload size), and its first row is its best.
  const seen = new Set<string>();
  const best = (chosen ?? []).filter((r) => {
    const id = `${r.db_kind} ${r.db_version} ${topology(r)}`;
    return seen.has(id) ? false : (seen.add(id), true);
  });
  return best.map((r, i) => ({...r, rank: i + 1}));
}

/** The single-machine stand's rows. */
export const standRows = (all: RatingRow[]) => topClass(all.filter((r) => onStand(r.hardware)));

/** Everything on more than one machine: clusters, replicas behind a proxy, MPP segment hosts. */
export const clusterRows = (all: RatingRow[]) => topClass(all.filter((r) => !onStand(r.hardware)));

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

/** When the board last changed: the latest run of any of its configurations. */
export const lastRun = (rows: RatingRow[]) => rows.reduce((a, r) => (r.last_run_at > a ? r.last_run_at : a), rows[0]?.last_run_at ?? '');

export const shareUrl = (row: RatingRow) => (row.share_token ? `${CLOUD}/s/${row.share_token}` : `${CLOUD}/leaderboard`);

export async function fetchRating(scenario: string, signal?: AbortSignal): Promise<Rating> {
  const url = ratingUrl(scenario);
  const res = await fetch(url, {signal, headers: {accept: 'application/json'}});
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const page = (await res.json()) as {data: RatingRow[]; metrics?: Metric[]};
  const data = standRows(page.data);
  const clusters = clusterRows(page.data);
  const key = (data[0] ?? clusters[0])?.metric;
  return {data, metric: page.metrics?.find((m) => m.key === key) ?? null, clusters};
}
