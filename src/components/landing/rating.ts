// The public rating of Stroppy Cloud (GET /api/v1/public/rating), as the
// landing reads it: plugins/cloud-rating.ts takes a copy at build time so
// the page renders with numbers, and the browser refreshes it on stroppy.io,
// which the API allows by CORS.

export const CLOUD = 'https://cloud.stroppy.io';
export const RATING_URL = `${CLOUD}/api/v1/public/rating`;

export type RatingRow = {
  rank: number;
  value: number;
  unit: string;
  db_kind: string;
  db_version: string;
  topology: {nodes: {role: string; engine: string; count: number}[]};
  hardware: {key: string; machines: {count: number; cpu: number; memory_gb: number}[]};
  workload_name: string;
  scenario: string;
  run_at: string;
  share_token?: string;
};

export type Rating = {
  metric: {key: string; title: string; unit: string; higher_is_better: boolean};
  data: RatingRow[];
};

const ENGINES: Record<string, string> = {
  postgres: 'PostgreSQL',
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

/** The database machine: "16 vCPU · 64 GB". */
export function machine(row: RatingRow): string {
  const m = row.hardware.machines[0];
  return m ? `${m.cpu} vCPU · ${m.memory_gb} GB` : row.hardware.key;
}

/** The workload the rows share, without the per-database suffix: "TPC-C 100 WH · 128 VU · 10 min". */
export const workload = (row: RatingRow) => row.workload_name.replace(/\s*\([^)]*\)\s*$/, '');

export const shareUrl = (row: RatingRow) => (row.share_token ? `${CLOUD}/s/${row.share_token}` : `${CLOUD}/leaderboard`);

export async function fetchRating(signal?: AbortSignal): Promise<Rating> {
  const res = await fetch(RATING_URL, {signal, headers: {accept: 'application/json'}});
  if (!res.ok) throw new Error(`${RATING_URL}: HTTP ${res.status}`);
  return (await res.json()) as Rating;
}
