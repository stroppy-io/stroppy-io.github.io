// The public rating of Stroppy Cloud (GET /api/v1/public/rating), as the
// landing reads it: plugins/cloud-rating.ts takes a copy at build time so
// the page renders with numbers, and the browser refreshes it on stroppy.io,
// which the API allows by CORS.

export const CLOUD = 'https://cloud.stroppy.io';

// The board compares like with like: one scenario (a round trip per
// statement; stored procedures run another scenario at about twice the speed)
// on one stand, a single 32-core node. A hardware class also names the
// platform and the data disk ("1x32c128g:standard-v3:network-ssd-nonreplicated"),
// which change when the nightly moves; the board takes the class of that
// stand with the most configurations, the latest run breaking a tie.
export const SCENARIO = 'tpcc/tx';
/** TPC-C with stored procedures: one round trip per transaction. */
export const SCENARIO_PROCS = 'tpcc/procs';
/** The stand every number on the site is measured on: one database machine, 32 vCPU, 128 GB. */
export const STAND = '1x32c128g';
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

export type Rating = {data: RatingRow[]};

/** The stand's own class: its key is the stand's, alone or with a platform and a disk after it. */
const onStand = (key: string) => key === STAND || key.startsWith(`${STAND}:`);

/** The stand's class with the most configurations, the latest run breaking a tie; ranked within it. */
export function standRows(all: RatingRow[]): RatingRow[] {
  const classes = new Map<string, RatingRow[]>();
  for (const r of all.filter((r) => onStand(r.hardware.key))) classes.set(r.hardware.key, [...(classes.get(r.hardware.key) ?? []), r]);
  const [chosen] = [...classes.values()].sort((a, b) => b.length - a.length || lastRun(b).localeCompare(lastRun(a)));
  return (chosen ?? []).map((r, i) => ({...r, rank: i + 1}));
}

const ENGINES: Record<string, string> = {
  postgres: 'PostgreSQL',
  orioledb: 'OrioleDB',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  picodata: 'Picodata',
  ydb: 'YDB',
  haproxy: 'HAProxy',
  pgbouncer: 'PgBouncer',
  odyssey: 'Odyssey',
  patroni: 'Patroni',
  etcd: 'etcd',
};

export const engine = (kind: string) => ENGINES[kind] ?? kind;

/** What stood behind the number apart from the database itself: "replica, HAProxy". */
export function topology(row: RatingRow): string {
  const extra = row.topology.nodes
    .filter((n) => n.role !== 'db' && n.role !== 'runner')
    .map((n) => {
      const name = n.role === 'db-replica' ? 'replica' : engine(n.engine);
      return n.count > 1 ? `${n.count}× ${name}` : name;
    });
  return extra.length ? `+ ${extra.join(', ')}` : 'single node';
}

const DISKS: Record<string, string> = {
  'network-ssd-nonreplicated': 'non-replicated SSD',
  'network-ssd-io-m3': 'io-m3 SSD',
  'network-ssd': 'SSD',
  'network-hdd': 'HDD',
};

/** The database machine: "32 vCPU · 128 GB · non-replicated SSD". */
export function machine(row: RatingRow): string {
  const m = row.hardware.machines[0];
  if (!m) return row.hardware.key;
  const disk = m.disk_type ? ` · ${DISKS[m.disk_type] ?? m.disk_type}` : '';
  return `${m.cpu} vCPU · ${m.memory_gb} GB${disk}`;
}

/** When the board last changed: the latest run of any of its configurations. */
export const lastRun = (rows: RatingRow[]) => rows.reduce((a, r) => (r.last_run_at > a ? r.last_run_at : a), rows[0]?.last_run_at ?? '');

/** The workload the rows share, without the per-database suffix: "TPC-C 100 WH · 128 VU · 10 min". */
export const workload = (row: RatingRow) => row.workload_name.replace(/\s*\([^)]*\)\s*$/, '');

export const shareUrl = (row: RatingRow) => (row.share_token ? `${CLOUD}/s/${row.share_token}` : `${CLOUD}/leaderboard`);

export async function fetchRating(scenario: string, signal?: AbortSignal): Promise<Rating> {
  const url = ratingUrl(scenario);
  const res = await fetch(url, {signal, headers: {accept: 'application/json'}});
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const page = (await res.json()) as Rating;
  return {data: standRows(page.data)};
}
