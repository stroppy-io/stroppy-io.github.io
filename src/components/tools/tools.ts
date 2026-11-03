// The four tools, each with a page at /tools/<id>. The Tools menu
// (src/components/nav/menu.ts) and every tool page's "other tools" read this.

export type ToolId = 'stroppy' | 'conformity' | 'graphene' | 'cloud';

export type Tool = {id: ToolId; name: string; what: string; href: string};

export const TOOLS: Tool[] = [
  {id: 'stroppy', name: 'Stroppy', what: 'The open-source load generator: one binary, TPC workloads', href: '/tools/stroppy'},
  {id: 'conformity', name: 'Stroppy Conformity', what: 'Does a database really speak the protocol it claims', href: '/tools/conformity'},
  {id: 'graphene', name: 'Graphene CI', what: 'The control plane that brings up the stand and runs the run', href: '/tools/graphene'},
  {id: 'cloud', name: 'Stroppy Cloud', what: 'Pick a database and a workload, get a report', href: '/tools/cloud'},
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
