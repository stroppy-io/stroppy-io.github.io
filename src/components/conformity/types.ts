// The shapes of stroppy-conformity's site export (schema 1), as far as the
// site reads them: compat.json, errata.json and details/<row id>.json. The contract is
// docs/site-export.md in stroppy-io/stroppy-conformity; fields are only ever
// added within schema 1, so everything not listed here is ignored.

export type Role = 'reference' | 'subject' | 'control';

export type Column = {
  id: string;
  label: string;
  description: string;
  unit: 'text' | 'percent' | 'count' | 'flag' | 'datetime' | 'points';
  path: string;
  default_visible: boolean;
  group: string;
};

export type Feature = {id: string; label: string; layer: string; group: string};

/** [code, matched, total], or null when the row ran no check of the feature. */
export type FeatureCell = [number, number, number] | null;

export type Finding = {id: string; outcome: string; summary: string; cells: number; clients?: string[]};

export type Row = {
  id: string;
  target: string;
  engine: string;
  base_engine: string;
  variant?: string;
  protocol: string;
  role: Role;
  claims: string;
  baseline: {reference: string; reason: string};
  image: string;
  image_digest?: string;
  measured_at: string;
  scores: Record<string, number | null>;
  coverage: Record<string, number | null>;
  counts: Record<string, Record<string, number>>;
  totals: Record<string, number>;
  severe: {crash: number; unresponsive: number; hang: number; protocol_violation: number; flagged: boolean};
  explain?: Record<string, string>;
  top_findings: Finding[];
  note?: string;
  details: string;
  feature_cells: FeatureCell[];
  /** The builds measured: `sut.claimed` is the product's own version (Greenplum 7.1.0), where `claims` is what the server reports (12.12). */
  builds?: {sut?: {claimed?: string}};
};

/** A storage engine, table access method or index extension, measured against the same build on its default (heap, InnoDB). */
export type AccessMethodRow = Row & {
  access_method: {
    table: string;
    version: string;
    pg_major?: string;
    extensions?: Record<string, string>;
    index?: string[];
    recall?: number;
  };
};

/** A client or tool of a protocol and the features (indexes into `features`) it relies on. */
export type ClientNeed = {client: string; declared: string[]; features: number[]};

/** A member of a product family against the family's own baseline (Greengage 6 against Greenplum 6). */
export type FamilyRow = {
  family: string;
  baseline: string;
  baseline_row: string;
  row: string;
  target: string;
  engine: string;
  protocol: string;
  claims: string;
  /** Checks both rows judged, and how many of them answered alike or differently. */
  cells: number;
  same: number;
  differ: number;
  /** Null when the two rows stand on different bases of the original (different_reference): no share is given then. */
  same_share: number | null;
  different_reference?: boolean;
  stated: {claims?: {text: string; quote?: string; source: string}[]};
};

/** A fork and what it forked from; `base` is the row of the upstream it is compared with. */
export type ForkRow = {
  row: string;
  target: string;
  engine: string;
  protocol: string;
  claims: string;
  upstream: string;
  base?: string;
  same_major: boolean;
  compared: boolean;
  lineage?: string;
};

/** A target measured and not published, and why. */
export type Unpublished = {target: string; protocol: string; role: Role; reason: string; engine: string};

/** errata.json: what a published result got wrong and what was done. */
export type Erratum = {
  id: string;
  date: string;
  dataset: string;
  targets: string[];
  protocol: string;
  what: string;
  /** Whose side the error was on: "ours" (the measurement) or the engine's. */
  cause: string;
  cause_detail: string;
  fix_title?: string;
  corrected_in: string;
  note?: string;
};

export type Errata = {schema: number; kind: string; entries: Erratum[]};

export type OutcomeInfo = {label: string; meaning: string; severity: number; counted: string};
export type FeatureCode = {code: number; outcome: string; label: string; color: string; meaning: string};

export type Legend = {
  outcomes: Record<string, OutcomeInfo>;
  roles: Record<string, string>;
  layers: Record<string, string>;
  scoring: string;
  baselines: string;
  caveats: string[];
  feature_codes: FeatureCode[];
  feature_cells: string;
  supported_types_filter?: string;
  core_profile?: string;
};

export type Compat = {
  schema: number;
  kind: string;
  generated_at: string;
  tool_version: string;
  dataset: {id: string; status: string; audited_at?: string; audit_tool_version?: string; audit?: {verdict: string; digest: string}};
  campaign: {id?: string; started: string; finished: string; hosts_count?: number; runs: number};
  defaults: {weights: Record<string, number>; score_formula: string; sort: {column: string; dir: 'asc' | 'desc'}[]};
  columns: Column[];
  features: Feature[];
  feature_sets: Record<string, number[]>;
  legend: Legend;
  rows: Row[];
  /** Per protocol, the clients and tools whose features the checks cover. */
  clients: Record<string, ClientNeed[]>;
  families: {rows: FamilyRow[]};
  forks: {rows: ForkRow[]};
  access_methods: {rows: AccessMethodRow[]};
  withheld: Unpublished[];
  not_measured: Unpublished[];
};

export type Suite = {
  suite: string;
  role: string;
  tier: number;
  baseline: string;
  total: number;
  denominator: number;
  executed: number;
  score: number | null;
  coverage: number | null;
  counts: Record<string, number>;
};

export type RootCause = {
  id: string;
  outcome: string;
  severity: number;
  signature: string;
  summary: string;
  concepts: string[];
  cells: number;
  checks: string[];
  clients?: string[];
  spec?: string;
  example?: {
    check_id: string;
    title: string;
    layer: string;
    reason?: string;
    diff?: string[];
    observed?: string;
    expected?: string;
    command?: string;
  };
  repro?: {kind: string; command?: string; script?: string; frames?: string[]; note?: string};
};

export type Details = {
  id: string;
  product?: string;
  run: {id: string; status: string; started: string; finished: string; tool_version: string; image: string; image_digest: string};
  suites: Suite[];
  root_causes: RootCause[];
  reproduce: {
    command: string;
    check_command: string;
    golden: string;
    tool_version: string;
    image_digest: string;
    baseline: string;
    run_id: string;
  };
  harness_note?: string;
};
