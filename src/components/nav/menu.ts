// The site's top menu: what opens under each navbar item (MegaMenu.tsx), the
// mobile drawer, and the footer's site map (src/theme/Footer). A section is
// named by what it holds. Its panel lists items in columns, or, with `parts`,
// lists the parts down the left and shows the hovered part's columns to the
// right. Every item has a one-line description, so the open menu shows what is
// inside a section. `strip` is a line of links along the panel's bottom.

import {PROTOCOL_ORDER, mapUrl, protocolShort} from '../conformity/data';
import {KIND_LABELS, type Kind} from '../ratings/score';
import {defaults, serialize, type State} from '../ratings/state';
import {DOCS, REPOS, TOOLS} from '../tools/tools';
import {VENDORS} from '../vendors/vendors';

export const CLOUD = 'https://cloud.stroppy.io';
export const GITHUB = 'https://github.com/stroppy-io/stroppy';
export const DISCORD = 'https://discord.gg/2mSSrkBkHm';

export type MenuLink = {label: string; href: string};
export type MenuItem = MenuLink & {desc: string};
export type MenuColumn = {title: string; items: MenuItem[]};
/** A part of a section: a page of its own, with the columns it shows. */
export type MenuPart = MenuItem & {columns: MenuColumn[]};
export type MenuStrip = {title: string; links: MenuLink[]};
/**
 * The card on the right of a panel. `art` draws a picture above the text;
 * `board` shows the top of the public leaderboard instead.
 */
export type MenuPromo = {
  kind: 'art' | 'board';
  title: string;
  body: string;
  href: string;
  cta: string;
};
type SectionBase = {id: string; label: string; href: string; promo: MenuPromo; strip?: MenuStrip};
export type MenuSection = SectionBase & ({parts: MenuPart[]} | {columns: MenuColumn[]});

/** Every item of a section, its parts' columns flattened. */
export const sectionItems = (s: MenuSection): MenuItem[] =>
  ('parts' in s ? s.parts.flatMap((p) => p.columns) : s.columns).flatMap((c) => c.items);

const item = (label: string, desc: string, href: string): MenuItem => ({label, desc, href});

// Benchmarks is /ratings: every item is one of the page's filters, so the
// menu offers what the page can show and nothing else. The query is built by
// the page's own serializer (src/components/ratings/state.ts).
const ratings = (s: Partial<State> = {}) => `/ratings${serialize({...defaults(PROTOCOL_ORDER), ...s}, PROTOCOL_ORDER)}`;

/**
 * The kinds a protocol's engines come in, as the page's Kind filter offers
 * them; MongoDB and Elasticsearch engines are each of one kind, so no filter.
 */
const KINDS_BY_PROTOCOL: {proto: string; kinds: Kind[]}[] = [
  {proto: 'pgwire', kinds: ['oltp', 'analytics', 'proxy']},
  {proto: 'mysql', kinds: ['oltp', 'analytics', 'search', 'proxy']},
];

const KIND_DESC: Record<Kind, string> = {
  oltp: 'Engines built for transactions',
  analytics: 'Warehouses, time series, streaming',
  search: 'Search engines with a SQL door',
  proxy: 'Poolers and sharding layers',
};

export const MENU: MenuSection[] = [
  {
    id: 'benchmarks',
    label: 'Benchmarks',
    href: ratings(),
    parts: [
      {
        ...item('By protocol', 'What your clients speak', ratings()),
        columns: [
          {
            title: 'Rated against the original',
            items: PROTOCOL_ORDER.map((p) =>
              item(`${protocolShort(p)}-compatible`, `Every engine next to ${protocolShort(p)} itself`, ratings({proto: p})),
            ),
          },
        ],
      },
      {
        ...item('By kind', 'Like compared with like', ratings({kind: 'oltp'})),
        columns: KINDS_BY_PROTOCOL.map((g) => ({
          title: `${protocolShort(g.proto)}-compatible`,
          items: g.kinds.map((k) => item(KIND_LABELS[k], KIND_DESC[k], ratings({proto: g.proto, kind: k}))),
        })),
      },
      {
        ...item('Shortlists', 'Filters and an order, set for you', ratings({min: 9, clean: true})),
        columns: [
          {
            title: 'Shortlists',
            items: [
              item('Drop-in replacements', 'Compatibility 9 or more, nothing broken', ratings({min: 9, clean: true})),
              item('Fastest first', 'Engines with a TPC-C run, by speed', ratings({bench: true, sort: 'speed'})),
            ],
          },
        ],
      },
    ],
    strip: {
      title: 'How we measure',
      links: [
        {label: 'Methodology', href: `${VENDORS}#fairness`},
        {label: 'Conformity map', href: mapUrl()},
        {label: 'Corrections', href: `${VENDORS}#corrections`},
      ],
    },
    promo: {
      kind: 'board',
      title: 'Who is ahead right now',
      body: 'Published runs on the same workload.',
      href: ratings(),
      cta: 'Open the ratings',
    },
  },
  {
    id: 'tools',
    label: 'Tools',
    href: TOOLS[0].href,
    // A part per tool, its page from src/components/tools/tools.ts. Items go
    // to a section of that page, or straight into the manual that covers it.
    parts: [
      {
        ...item('Stroppy', TOOLS[0].what, TOOLS[0].href),
        columns: [
          {
            title: 'Stroppy',
            items: [
              item('Install and run', 'A binary, the Docker image or a build', '/tools/stroppy#install'),
              item('Workloads', 'TPC-B, TPC-C, TPC-H, TPC-DS or your own SQL', '/tools/stroppy#workloads'),
              item('Drivers and config', 'PostgreSQL, MySQL, YDB, Picodata', '/tools/stroppy#drivers'),
              item('Reports and metrics', 'One JSON report, OTLP live', '/tools/stroppy#reports'),
              item('Client overhead', 'How fast Stroppy itself goes', '/tools/stroppy#baseline'),
            ],
          },
          {
            title: 'In the manual',
            items: [
              item('Getting started', 'Install and run a first test', '/docs/introduction'),
              item('CLI reference', 'Every command and flag', '/docs/cli-reference'),
              item('Custom workloads', 'Write, test and ship your own', '/docs/custom-workloads'),
              item('GitHub', 'Source, issues and releases', REPOS.stroppy),
            ],
          },
        ],
      },
      {
        ...item('Stroppy Conformity', TOOLS[1].what, TOOLS[1].href),
        columns: [
          {
            title: 'Stroppy Conformity',
            items: [
              item('Results', 'Every engine, check by check', mapUrl()),
              item('What it covers', 'Five protocols, every layer', '/tools/conformity#coverage'),
              item('Why the numbers hold up', 'Evidence for every verdict', '/tools/conformity#evidence'),
              item('Try it', 'An original and an engine, side by side', '/tools/conformity#try'),
              item('Measure your build', 'Your branch against the original', '/tools/conformity#your-build'),
            ],
          },
          {
            title: 'In the manual',
            items: [
              item('Methodology', 'How each verdict is decided', DOCS.conformityDoc('methodology.md')),
              item('Targets', 'Every engine and its image', DOCS.conformityDoc('targets.md')),
              item('For agents', 'An MCP server over the data', DOCS.conformityDoc('agents.md')),
            ],
          },
        ],
      },
      {
        ...item('Graphene CI', TOOLS[2].what, TOOLS[2].href),
        columns: [
          {
            title: 'Graphene CI',
            items: [
              item('How it works', 'Pipelines in Go, resources a run owns', '/tools/graphene#model'),
              item('In Stroppy Cloud', 'What a run brings up and tears down', '/tools/graphene#stroppy'),
              item('Get started', 'A plan, then the development stack', '/tools/graphene#start'),
            ],
          },
          {
            title: 'In the manual',
            items: [
              item('Concepts', 'The model behind it', DOCS.grapheneDoc('concepts/architecture')),
              item('First local plan', 'Try it on your machine', DOCS.grapheneDoc('start/first-look')),
              item('graphenectl', 'The command line', DOCS.grapheneDoc('graphenectl')),
              item('Studio', 'Runs and their resources, visually', DOCS.grapheneDoc('studio')),
            ],
          },
        ],
      },
      {
        ...item('Stroppy Cloud', TOOLS[3].what, TOOLS[3].href),
        columns: [
          {
            title: 'Stroppy Cloud',
            items: [
              item('Databases', 'Seven engines, or one you already run', '/tools/cloud#databases'),
              item('A run', 'Machines in your cloud, then the load', '/tools/cloud#run'),
              item('Compare, schedule, share', 'Suites, cron, public links', '/tools/cloud#share'),
              item('API and CI', 'Launch from a pipeline, hear back by webhook', '/tools/cloud#api'),
            ],
          },
          {
            title: 'Get going',
            items: [
              item('How it works', 'A run, a screen at a time', '/how'),
              item('Create an account', 'cloud.stroppy.io', `${CLOUD}/register`),
            ],
          },
        ],
      },
    ],
    promo: {
      kind: 'art',
      title: 'How Stroppy Cloud works',
      body: 'What you describe, what comes up, what stays after the run.',
      href: '/how',
      cta: 'See how it works',
    },
  },
  {
    id: 'docs',
    label: 'Documentation',
    href: DOCS.stroppy,
    parts: [
      {
        ...item('Stroppy', 'CLI manual, versioned', DOCS.stroppy),
        columns: [
          {
            title: 'Start',
            items: [
              item('Getting started', 'Install and run a first test', '/docs/introduction'),
              item('CLI reference', 'Every command and flag', '/docs/cli-reference'),
              item('Config file', 'Presets and overrides', '/docs/config-file'),
            ],
          },
          {
            title: 'Deeper',
            items: [
              item('Workloads', 'TPC-B, TPC-C, TPC-H, TPC-DS in detail', '/docs/tests/tpcc'),
              item('Custom workloads', 'Write, test and ship your own', '/docs/custom-workloads'),
              item('Changelog', 'What changed in every release', '/docs/changelog'),
            ],
          },
        ],
      },
      {
        ...item('Stroppy Conformity', 'Methodology and the data, on GitHub', DOCS.conformity),
        columns: [
          {
            title: 'Read',
            items: [
              item('Methodology', 'How each verdict is decided', DOCS.conformityDoc('methodology.md')),
              item('Report format', 'The report JSON and its schema', DOCS.conformityDoc('report-format.md')),
              item('Measure your build', 'Your endpoint, step by step', DOCS.conformityDoc('measure-your-build.md')),
            ],
          },
        ],
      },
      {
        ...item('Graphene CI', 'The control plane’s own manual', DOCS.graphene),
        columns: [
          {
            title: 'Learn',
            items: [
              item('Concepts', 'The model behind it', DOCS.grapheneDoc('concepts/architecture')),
              item('First development run', 'From plan to run', DOCS.grapheneDoc('start/end-to-end')),
            ],
          },
          {
            title: 'Reference',
            items: [
              item('SDK', 'Writing a pipeline in Go', DOCS.grapheneDoc('sdk/reference')),
              item('Management API', 'Everything graphenectl does', DOCS.grapheneDoc('api')),
            ],
          },
        ],
      },
    ],
    strip: {
      title: 'Also',
      links: [
        {label: 'Technical blog', href: '/blog'},
        {label: 'How Stroppy Cloud works', href: '/how'},
        {label: 'Discord', href: DISCORD},
        {label: 'GitHub', href: GITHUB},
      ],
    },
    promo: {
      kind: 'art',
      title: 'Why we moved Stroppy from k6',
      body: 'One Go binary instead of k6 and TypeScript, and what it did to the numbers.',
      href: '/blog/why-stroppy-moved-off-k6',
      cta: 'Read the post',
    },
  },
  {
    id: 'vendors',
    label: 'Vendors',
    href: VENDORS,
    // Every item is a section of /vendors (src/pages/vendors.tsx).
    columns: [
      {
        title: 'Get measured',
        items: [
          item('Add your database', 'An issue with what we need to run it', `${VENDORS}#add`),
          item('Run the tests on your build', 'The same workload and checks, before a release', `${VENDORS}#preview`),
        ],
      },
      {
        title: 'Fair play',
        items: [
          item('How we keep it fair', 'Same tests, same machine, the original as reference', `${VENDORS}#fairness`),
          item('Reproduce a result', 'Every number opens its source', `${VENDORS}#reproduce`),
          item('Report an error', 'An issue with the result and how to see it', `${VENDORS}#dispute`),
          item('Corrections', 'Every result we changed, dated', `${VENDORS}#corrections`),
        ],
      },
      {
        title: 'Talk to us',
        items: [item('Discord', 'Questions and partnerships', DISCORD)],
      },
    ],
    promo: {
      kind: 'art',
      title: 'Think we got it wrong?',
      body: 'Open an issue with the result and how to see it. If we were wrong, the correction is published.',
      href: `${VENDORS}#dispute`,
      cta: 'Report an error',
    },
  },
];
