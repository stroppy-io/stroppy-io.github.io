// What the /how diagrams show, from Stroppy Cloud's own how-it-works deck
// (stroppy-cloud web, before the public face moved here): the product model
// and the architecture, each with the paths a story walks through.

import type {DiagramEdge, DiagramFocus, DiagramGroup, DiagramNode} from './Diagram';

/* ---------- The product: what a benchmark is built from ---------- */

const PRODUCT_NODES: DiagramNode[] = [
  {
    id: 'database',
    icon: 'database',
    area: 'db',
    title: 'Database',
    body: 'What you’re testing: the DBMS, its version and how the nodes connect.',
    sample: 'PostgreSQL 17 · Patroni, 3 nodes',
    more: 'The database you want to test: PostgreSQL, MySQL, YDB, CockroachDB and more, its version, topology (one node, replicas, a Patroni or Galera cluster) and settings. Describe it once and drop it into any test after that.',
    foot: 'Console → Library → Databases',
    facts: [
      {
        label: 'Engines',
        items: ['PostgreSQL 15–18', 'MySQL 8.0 / 8.4', 'MariaDB 10.11–11.8', 'YDB', 'CockroachDB', 'OrioleDB', 'Picodata', 'your own database by address'],
      },
      {label: 'Topologies', items: ['single node', 'replicas', 'Patroni + etcd', 'semi-sync', 'Group Replication', 'Galera']},
    ],
  },
  {
    id: 'workload',
    icon: 'zap',
    area: 'wl',
    title: 'Workload',
    body: 'How you load it: the scenario, the number of users and how long.',
    sample: 'TPC-C · 64 VU · 10 min',
    more: 'A load scenario, for example “load the TPC-C data, then run 64 virtual users for 10 minutes”. A workload isn’t tied to a database, so you can run the same one on PostgreSQL and on MySQL and compare them fairly.',
    foot: 'Console → Library → Workloads',
    facts: [
      {label: 'Scenarios', items: ['TPC-C', 'TPC-B', 'TPC-H', 'TPC-DS', 'your own SQL']},
      {label: 'Segments', items: ['data load', 'warmup', 'load']},
      {label: 'Parameters', items: ['VUs', 'duration', 'warmup', 'stroppy script']},
    ],
  },
  {
    id: 'test',
    icon: 'flask',
    area: 'test',
    title: 'Test',
    body: 'What you launch: a database, a workload and machine sizes.',
    sample: 'db S ×3 · runner S',
    more: 'A test ties a database to a workload and says which machines to run them on: how much CPU and memory the database nodes and the runner get. Before you launch, Stroppy Cloud checks the machines are big enough and suggests sizes if they aren’t.',
    foot: 'Console → Tests',
    facts: [
      {label: 'Roles', items: ['db', 'replica', 'proxy', 'runner']},
      {label: 'Sizes', items: ['XS', 'S', 'M', 'L', 'XL']},
      {label: 'Before launch', items: ['hardware checked against roles', 'suggested sizes']},
    ],
  },
  {
    id: 'suite',
    icon: 'layers',
    area: 'suite',
    title: 'Suite',
    body: 'Several variants of a test at once, to compare them.',
    sample: '3 versions × 2 sizes = 6 runs',
    more: 'A suite is for questions like “which is faster”: PostgreSQL 16 or 17, S machines or M. You list the variants, the suite runs them all and puts the results in one table.',
    foot: 'Console → Suites',
    facts: [
      {label: 'Matrix axes', items: ['tests', 'sizes', 'versions', 'parameters']},
      {label: 'Outcome', items: ['one comparison table']},
    ],
  },
  {
    id: 'schedule',
    icon: 'clock',
    area: 'sched',
    title: 'Schedule',
    body: 'Launches a test on its own, on cron.',
    sample: 'nightly at 03:00',
    more: 'Every night at 03:00, say. That way you notice a new version or new database settings got slower before production does; each of those runs leaves an ordinary report.',
    foot: 'Console → Schedules',
    facts: [
      {label: 'Launches', items: ['a test', 'a suite']},
      {label: 'For', items: ['regressions', 'history on a chart']},
    ],
  },
  {
    id: 'provider',
    icon: 'cloud',
    area: 'prov',
    title: 'Provider',
    body: 'Your cloud account, where the machines come up.',
    sample: 'service account key',
    more: 'A key to your cloud account. Stroppy Cloud creates machines there for the length of a run and removes them afterwards; the cloud bills you for them directly.',
    foot: 'Console → Settings → Providers',
    facts: [
      {label: 'Access', items: ['service account key', 'checked before saving']},
      {label: 'Billing', items: ['straight to your cloud']},
    ],
  },
  {
    id: 'run',
    icon: 'play',
    area: 'run',
    title: 'Run',
    body: 'One run of a test: the stand, the load, the result.',
    sample: 'load running · 7:12 of 10:00',
    more: 'Every press of Launch creates a run. Stroppy Cloud brings up the stand in your cloud, installs, tunes and checks the database and drives the load, while you watch logs, metrics and QPS in the console.',
    foot: 'Console → Runs',
    facts: [
      {label: 'Phases', items: ['stand', 'deploy', 'load', 'collect', 'teardown']},
      {label: 'Live', items: ['logs', 'metrics', 'QPS', 'events']},
      {label: 'Stand', items: ['removed by itself', 'can be kept for a while']},
    ],
  },
  {
    id: 'results',
    icon: 'chart',
    area: 'res',
    title: 'Results',
    body: 'How many queries per second the database handled, and at what latency.',
    sample: '212 tps · 0 errors',
    chips: ['Report', 'Compare', 'Rating', 'Link'],
    more: 'A run leaves a report: QPS, latency, errors and charts for each segment. You can compare it with other runs, send it to the rating or open it for colleagues by a public link.',
    foot: 'Console → Runs, Compare, Rating',
    facts: [
      {label: 'Report', items: ['QPS / TPS', 'latency p50–p99', 'errors', 'charts']},
      {label: 'Next', items: ['compare runs', 'tenant rating', 'public rating', 'overview link']},
    ],
  },
];

export const PRODUCT_GROUPS: DiagramGroup[] = [
  {
    id: 'tenant',
    label: 'Tenant: your team’s space; everything else lives in it',
    icon: 'home',
    dashed: true,
    columns: 4,
    areas: `"db . suite ." "wl test run res" ". sched prov ."`,
    nodes: PRODUCT_NODES,
  },
];

export const PRODUCT_EDGES: DiagramEdge[] = [
  {from: 'database', to: 'test'},
  {from: 'workload', to: 'test'},
  {from: 'test', to: 'run'},
  {from: 'test', to: 'suite'},
  {from: 'suite', to: 'run'},
  {from: 'schedule', to: 'run'},
  {from: 'provider', to: 'run'},
  {from: 'run', to: 'results'},
];

export type Step = {id: string; title: string; body: string; focus: DiagramFocus | null};

export const PRODUCT_STEPS: Step[] = [
  {
    id: 'all',
    title: 'Overview',
    body: 'On the left is what you describe once and reuse across tests: databases and workloads. In the middle sit the test and the three ways to launch it, and on the right the report a run leaves behind. Hover a block for an example and details.',
    focus: null,
  },
  {
    id: 'first',
    title: 'First run',
    body: 'Describe a database (say, PostgreSQL 17 on three nodes with Patroni) and a workload (TPC-C for 10 minutes), make a test from them, add your cloud key and press Launch. The stand comes up on its own, and the report appears once the load ends.',
    focus: {
      nodes: ['database', 'workload', 'test', 'provider', 'run', 'results'],
      edges: ['database-test', 'workload-test', 'test-run', 'provider-run', 'run-results'],
    },
  },
  {
    id: 'compare',
    title: 'Compare variants',
    body: 'A suite is for questions like “which is faster”: PostgreSQL 16 or 17, S machines or M. You list the variants, the suite runs them all and puts the results in one table.',
    focus: {nodes: ['test', 'suite', 'run', 'results'], edges: ['test-suite', 'suite-run', 'run-results']},
  },
  {
    id: 'regress',
    title: 'Watch for regressions',
    body: 'A schedule launches a test or a suite on cron, every night for example. If a new DBMS version or new settings turn out slower, you see it on the history chart before your users do.',
    focus: {nodes: ['schedule', 'run', 'results'], edges: ['schedule-run', 'run-results']},
  },
  {
    id: 'share',
    title: 'Show the result',
    body: 'The report opens by a public link, no sign-in needed. You can send a run to the public rating, where it’s ranked against setups of the same sizes, and embed that rating on your own site.',
    focus: {nodes: ['run', 'results'], edges: ['run-results']},
  },
];

export const LIFECYCLE: {title: string; body: string}[] = [
  {title: 'Stand', body: 'Stroppy Cloud creates the network and machines in your cloud with your key, and an agent starts on each machine.'},
  {title: 'Deploy', body: 'The agents start the DBMS in containers, tuned for its machines; the cluster forms, and the stand passes its checks before any load.'},
  {title: 'Load', body: 'stroppy drives the load segment by segment while you watch QPS, latency and logs in the console.'},
  {title: 'Collect', body: 'Metrics from the load window go into the report.'},
  {title: 'Teardown', body: 'The machines are removed unless you asked to keep the stand. The report stays.'},
];

/* ---------- The architecture: where each part runs ---------- */

type Spec = Omit<DiagramNode, 'area'> & {area?: string};

const node = (s: Spec): DiagramNode => ({area: '', ...s});

export const ARCH_GROUPS: DiagramGroup[] = [
  {
    id: 'cloud',
    label: 'Stroppy Cloud',
    icon: 'server',
    columns: 4,
    areas: `"identity console api pipes"`,
    depsLabel: 'Dependencies',
    nodes: [
      node({
        id: 'console',
        icon: 'monitor',
        area: 'console',
        client: true,
        title: 'Console',
        body: 'The web app.',
        sample: 'in the browser · React',
        more: 'A single-page app. It reads data from the Stroppy Cloud server over REST and gets the live run (logs, metrics, progress) over one WebSocket, with no page reloads.',
      }),
      node({
        id: 'api',
        icon: 'code',
        area: 'api',
        title: 'Server',
        body: 'API, tenants, runs.',
        sample: 'Go · REST (OpenAPI) · WebSocket',
        more: 'The product server; everything a user does goes through it: tenants and roles, the library, building a test into a full run spec, quotas, launching in Graphene, the live run, rating, compare and public reports.',
        facts: [{label: 'Does', items: ['tenants and roles', 'building the run spec', 'quotas', 'the live run', 'rating and links']}],
      }),
      node({
        id: 'identity',
        icon: 'shield',
        area: 'identity',
        title: 'Accounts',
        body: 'Sign-in and sessions.',
        sample: 'JWT ES256 · checked on the server',
        more: 'Sign up with GitHub or e-mail, sign in, e-mail confirmation and recovery by code. A session becomes a short-lived JWT; the server checks its signature itself, with no call per request.',
      }),
      node({
        id: 'pipes',
        icon: 'branch',
        area: 'pipes',
        title: 'Pipelines',
        body: 'stroppy-run, stroppy-quotas, stroppy-provider-verify, stroppy-provider-config.',
        sample: 'Go · Graphene SDK',
        more: 'The run’s code, in plain Go: create the network and machines, deploy containers, drive the load segments, collect the result. It ships in one image with the server, which publishes the binaries and manifests into every tenant’s namespace on start.',
        facts: [{label: 'Version', items: ['matches the server’s version', 'published into every tenant']}],
      }),
    ],
    deps: [
      node({
        id: 'state',
        icon: 'database',
        title: 'Server database',
        body: 'Tenants, tests, results.',
        sample: 'PostgreSQL',
        more: 'Everything created in the console, plus the list and results of runs. Cloud keys aren’t here: they’re stored as secrets in the tenant’s namespace in Graphene.',
      }),
      node({
        id: 'kratos',
        icon: 'key',
        title: 'Ory Kratos',
        body: 'Sign-in, email, codes.',
        sample: 'self-hosted · PostgreSQL',
        more: 'A separate self-hosted install: sign-up, sign-in, email verification, recovery by code and TOTP, with its own database in Postgres. The server doesn’t call it per request; it only checks the JWT signature.',
      }),
    ],
  },
  {
    id: 'graphene',
    label: 'Graphene: runs the pipelines',
    icon: 'network',
    columns: 4,
    areas: `"crossplane worker door door"`,
    depsLabel: 'Dependencies',
    nodes: [
      node({
        id: 'door',
        icon: 'repeat',
        area: 'door',
        title: 'Graphene server',
        body: 'The entry point to Graphene.',
        sample: 'Go · gRPC · Connect',
        more: 'Everyone reaches Graphene through one port: management (Connect), workers and agents (gRPC), the image registry (/v2), telemetry intake (OTLP). The server checks namespace access and drives the runs.',
        facts: [{label: 'Through one port', items: ['Connect: management', 'gRPC: agents and workers', '/v2: registry', 'OTLP: telemetry']}],
      }),
      node({
        id: 'worker',
        icon: 'play',
        area: 'worker',
        title: 'Run worker',
        body: 'Runs stroppy-run.',
        sample: 'managed worker',
        more: 'When a run starts, Graphene starts a container with the pipeline image. It drives the workflow through its phases and stops once the run is over and all its resources are gone.',
        facts: [
          {label: 'Runs', items: ['while the run goes', 'until its resources are removed']},
          {label: 'Where', items: ['a k8s Deployment per run']},
        ],
      }),
      node({
        id: 'crossplane',
        icon: 'cloud',
        area: 'crossplane',
        title: 'Run resources',
        body: 'The run’s network and machines.',
        sample: 'network · VM · SG',
        more: 'The part of the pipeline that declares the run’s security group, subnets and VMs as resources of the run. Graphene owns them and removes them in order: machines first, then the subnets and the group. The network itself belongs to the provider profile and stays.',
        facts: [{label: 'Access', items: ['ProviderConfig t-<tenant>', 'key from the tenant’s secret']}],
      }),
    ],
    deps: [
      node({
        id: 'temporal',
        icon: 'history',
        title: 'Temporal',
        body: 'Keeps the state of runs.',
        sample: 'Temporal · PostgreSQL',
        more: 'In Temporal a run is a workflow, and each of its resources (a machine, a container, an artifact, the stand) is a separate record with an owner. That’s why resources always get removed, children before their parent, and a crashed worker doesn’t lose the run.',
        facts: [
          {label: 'A run’s records', items: ['network', 'machine', 'container', 'artifact', 'stand']},
          {label: 'Guarantees', items: ['child resources go first', 'a run survives a worker crash']},
        ],
      }),
      node({
        id: 'k8s',
        icon: 'grid',
        title: 'Kubernetes',
        body: 'Where workers live.',
        sample: 'managed backend',
        more: 'The platform Graphene runs on. For each run it creates a worker Deployment with the pipeline image and deletes it when the run is over. Crossplane runs here too.',
      }),
      node({
        id: 'xp',
        icon: 'upload',
        title: 'Crossplane',
        body: 'Cloud resources.',
        sample: 'cloud providers',
        more: 'Creates networks and machines in your account through the tenant’s ProviderConfig, built from its secret, and removes them in a cascade with the run.',
      }),
      node({
        id: 'oci',
        icon: 'download',
        title: 'Docker registry',
        body: 'Pipeline images.',
        sample: 'OCI',
        more: 'Tenants’ pipelines: a manifest and an image. Identical layers are stored once and served through Graphene (/v2); the registry itself isn’t reachable from outside.',
      }),
      node({
        id: 'telemetry',
        icon: 'chart',
        title: 'Telemetry',
        body: 'Metrics, logs, traces.',
        sample: 'VictoriaMetrics · VictoriaLogs · Grafana',
        more: 'Everything a run writes about itself, over standard protocols. The Stroppy server reads it through Graphene with the tenant’s rights, so the storage addresses stay inside.',
      }),
      node({
        id: 'blobs',
        icon: 'folder',
        title: 'Artifacts',
        body: 'Reports and raw data.',
        sample: 'S3',
        more: 'Files the run takes from the machines: stroppy’s raw output and the report. Kept in S3, they outlive the stand.',
      }),
    ],
  },
  {
    id: 'yours',
    label: 'Your cloud: the stand',
    icon: 'cloud',
    dashed: true,
    columns: 3,
    areas: `"network agent exporters" "runner proxy db"`,
    depsLabel: 'Dependencies',
    nodes: [
      node({
        id: 'network',
        icon: 'network',
        area: 'network',
        title: 'Network',
        body: 'VPC, subnet, security group.',
        sample: 'VPC · subnet · SG',
        more: 'The network is created once with the provider profile (or you name your own), and every run gets its own subnets and security group in it. The server hands each run free address blocks, so runs side by side do not see each other.',
      }),
      node({
        id: 'agent',
        icon: 'box',
        area: 'agent',
        title: 'Agent',
        body: 'On every machine.',
        sample: 'graphene-agent',
        more: 'Installed by cloud-init, it keeps its own outgoing gRPC session to Graphene (opens no ports), starts the run’s containers and ships their telemetry.',
        facts: [
          {label: 'Does', items: ['start a container', 'put a file', 'run a command', 'take an artifact']},
          {label: 'Network', items: ['outgoing gRPC', 'listens on no ports']},
        ],
      }),
      node({
        id: 'exporters',
        icon: 'activity',
        area: 'exporters',
        title: 'Exporters',
        body: 'Machine and DBMS metrics.',
        sample: 'node_exporter · postgres_exporter…',
        more: 'Machine and DBMS exporters run next to the database. The agent scrapes them and sends their metrics, together with stroppy’s, to Graphene over OTLP.',
      }),
      node({
        id: 'runner',
        icon: 'zap',
        area: 'runner',
        title: 'Runner',
        body: 'stroppy with the load.',
        sample: 'stroppy',
        more: 'A separate machine with stroppy: loads the data and drives the scenario in segments; metrics leave through the agent.',
      }),
      node({
        id: 'proxy',
        icon: 'shuffle',
        area: 'proxy',
        title: 'Proxy and consensus',
        body: 'For fault-tolerant topologies.',
        sample: 'HAProxy · etcd',
        more: 'The cluster’s entry point and its state store: etcd remembers Patroni’s leader, HAProxy checks /primary and routes to the current leader. A single-node topology has neither.',
      }),
      node({
        id: 'db',
        icon: 'database',
        area: 'db',
        title: 'Database',
        body: 'DBMS containers.',
        sample: 'DBMS image',
        more: 'The chosen DBMS and topology (nodes, replicas, proxies) run as docker images on the stand machines for as long as the run goes, unless you keep the stand.',
        facts: [{label: 'Installed as', items: ['docker images only', 'no packages on the host']}],
      }),
    ],
    deps: [
      node({
        id: 'vm',
        icon: 'server',
        title: 'Cloud',
        body: 'Network and virtual machines.',
        sample: 'your cloud account',
        more: 'Your account: the network and VMs are created in it with the tenant’s key and removed after the run. You pay the cloud directly.',
      }),
      node({
        id: 'docker',
        icon: 'layers',
        title: 'Docker',
        body: 'Runtime on the machines.',
        sample: 'the run’s containers',
        more: 'DBMS, proxies and exporters ship as docker images only; nothing gets installed on the host. The agent starts the run’s containers and removes them when the run ends.',
      }),
    ],
  },
];

export const ARCH_EDGES: DiagramEdge[] = [
  {from: 'console', to: 'api', label: 'REST · WS'},
  {from: 'console', to: 'identity', label: 'sign-in'},
  {from: 'api', to: 'door', label: 'StartRun · Watch'},
  {from: 'pipes', to: 'door', label: '/v2'},
  {from: 'door', to: 'worker', label: 'workflow'},
  {from: 'worker', to: 'crossplane', label: 'resources'},
  {from: 'crossplane', to: 'network', label: 'VMs with your key'},
  {from: 'network', to: 'agent', label: 'cloud-init'},
  {from: 'agent', to: 'door', label: 'gRPC · OTLP'},
  {from: 'agent', to: 'exporters', label: 'scrape'},
  {from: 'runner', to: 'proxy', label: 'load'},
  {from: 'proxy', to: 'db'},
  // What each part stands on.
  {from: 'api', to: 'state', hidden: true},
  {from: 'identity', to: 'kratos', hidden: true},
  {from: 'door', to: 'temporal', hidden: true},
  {from: 'worker', to: 'temporal', hidden: true},
  {from: 'worker', to: 'k8s', hidden: true},
  {from: 'door', to: 'oci', hidden: true},
  {from: 'worker', to: 'oci', hidden: true},
  {from: 'crossplane', to: 'xp', hidden: true},
  {from: 'door', to: 'telemetry', hidden: true},
  {from: 'worker', to: 'blobs', hidden: true},
  {from: 'network', to: 'vm', hidden: true},
  {from: 'agent', to: 'docker', hidden: true},
  {from: 'db', to: 'docker', hidden: true},
];

export const ARCH_STEPS: Step[] = [
  {
    id: 'all',
    title: 'Overview',
    body: 'Three zones: the Stroppy Cloud product (the console in your browser and the server), Graphene, which runs the pipelines, and your cloud with the stand. Each zone lists its dependencies underneath; hover a block to see what it depends on.',
    focus: null,
  },
  {
    id: 'launch',
    title: 'Launch',
    body: 'The console asks the server to launch a test. The server checks rights and quotas, builds the test into a run spec and starts the run in Graphene, which records it as a workflow in Temporal.',
    focus: {
      nodes: ['console', 'api', 'identity', 'state', 'kratos', 'door', 'temporal'],
      edges: ['console-api', 'console-identity', 'api-door', 'api-state', 'identity-kratos', 'door-temporal'],
    },
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    body: 'Graphene starts a worker with the stroppy-run image from its registry. The Stroppy server uploaded that image on start, so the pipeline’s version always matches the server’s.',
    focus: {
      nodes: ['pipes', 'oci', 'door', 'worker', 'temporal', 'k8s'],
      edges: ['pipes-door', 'door-oci', 'worker-oci', 'door-worker', 'worker-temporal', 'worker-k8s'],
    },
  },
  {
    id: 'stand',
    title: 'Stand',
    body: 'The worker declares the network and machines; Crossplane creates them in your account with the tenant’s key. An agent comes up on every machine and connects to Graphene by itself.',
    focus: {
      nodes: ['worker', 'crossplane', 'xp', 'network', 'vm', 'agent', 'door'],
      edges: ['worker-crossplane', 'crossplane-xp', 'crossplane-network', 'network-vm', 'network-agent', 'agent-door'],
    },
  },
  {
    id: 'run',
    title: 'Run',
    body: 'Agents start the database, proxy and exporter containers; the stroppy runner loads data and drives the load segments through the proxy.',
    focus: {
      nodes: ['agent', 'docker', 'runner', 'proxy', 'db', 'exporters'],
      edges: ['agent-docker', 'db-docker', 'runner-proxy', 'proxy-db', 'agent-exporters'],
    },
  },
  {
    id: 'observe',
    title: 'Observe',
    body: 'The agent scrapes the exporters and sends metrics and logs over OTLP to Graphene; artifacts go to S3. The server reads all of it through Graphene and pushes it to the console over WebSocket.',
    focus: {
      nodes: ['exporters', 'agent', 'door', 'telemetry', 'worker', 'blobs', 'api', 'console'],
      edges: ['agent-exporters', 'agent-door', 'door-telemetry', 'worker-blobs', 'api-door', 'console-api'],
    },
  },
];
