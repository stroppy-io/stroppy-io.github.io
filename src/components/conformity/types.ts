// The shapes of stroppy-conformity's site export (schema 1), as far as this
// page reads them: compat.json and details/<row id>.json. The contract is
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
};

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
  reproduce: {command: string; check_command: string; golden: string; tool_version: string; image_digest: string; baseline: string; run_id: string};
  harness_note?: string;
};
