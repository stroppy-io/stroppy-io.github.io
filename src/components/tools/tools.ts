// The four tools, each with a page at /tools/<id>. The Tools menu
// (src/components/nav/menu.ts) and every tool page's "other tools" read this.

export type ToolId = 'stroppy' | 'conformity' | 'graphene' | 'cloud';

/** `kind` is what sort of tool it is; `facts` are its short facts. Its page and the landing show both. */
export type Tool = {id: ToolId; name: string; kind: string; what: string; facts: string[]; href: string};

export const TOOLS: Tool[] = [
  {
    id: 'stroppy',
    name: 'Stroppy',
    kind: 'Load generator · open source',
    facts: ['One Go binary', 'TPC-B, TPC-C, TPC-H, TPC-DS', 'PostgreSQL, MySQL, YDB, Picodata', 'Apache-2.0'],
    what: 'The open-source load generator: one binary, TPC workloads',
    href: '/tools/stroppy',
  },
  {
    id: 'conformity',
    name: 'Stroppy Conformity',
    kind: 'Protocol conformity · open source',
    facts: ['Five protocols', 'Expected values from the real engine', 'No account needed', 'Apache-2.0'],
    what: 'Does a database really speak the protocol it claims',
    href: '/tools/conformity',
  },
  {
    id: 'graphene',
    name: 'Graphene CI',
    kind: 'Control plane for CI',
    facts: ['Pipelines in Go', 'Docker, Kubernetes, Crossplane, Git, files', 'CLI, Studio and an API'],
    what: 'The control plane that brings up the stand and runs the run',
    href: '/tools/graphene',
  },
  {
    id: 'cloud',
    name: 'Stroppy Cloud',
    kind: 'Benchmarking as a service',
    facts: ['Your cloud account: Yandex Cloud or AWS', 'Stroppy and Graphene CI underneath', 'Public reports by link'],
    what: 'Pick a database and a workload, get a report',
    href: '/tools/cloud',
  },
];

/** Where each manual lives. */
export const DOCS = {
  stroppy: '/docs/introduction',
  conformity: 'https://github.com/stroppy-io/stroppy-conformity#readme',
  conformityDoc: (file: string) => `https://github.com/stroppy-io/stroppy-conformity/blob/main/docs/${file}`,
  graphene: 'https://graphene-ci.github.io/docs/',
  grapheneDoc: (path: string) => `https://graphene-ci.github.io/docs/${path}`,
};

export const REPOS = {
  stroppy: 'https://github.com/stroppy-io/stroppy',
  conformity: 'https://github.com/stroppy-io/stroppy-conformity',
  graphene: 'https://github.com/graphene-ci',
};
