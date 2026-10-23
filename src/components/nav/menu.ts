// The site's top menu: what opens under each navbar item (MegaMenu.tsx),
// and the footer's site map (src/theme/Footer). A section is named by what it
// holds and is a page of its own: hovering its name opens the panel,
// clicking it goes to `href`. Items have an icon (icons.tsx) and a one-line
// description, so the open menu shows what is inside a section.

export const CLOUD = 'https://cloud.stroppy.io';

export type MenuItem = {label: string; desc: string; href: string; icon: string};
export type MenuColumn = {title: string; items: MenuItem[]};
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
export type MenuSection = {id: string; label: string; href: string; columns: MenuColumn[]; promo: MenuPromo};

export const MENU: MenuSection[] = [
  {
    id: 'how',
    label: 'How it works',
    href: '/how',
    columns: [
      {
        title: 'Run a benchmark',
        items: [
          {label: 'Stroppy Cloud', desc: 'Pick a database and a workload, get a report', href: '/how', icon: 'cloud'},
          {label: 'Stroppy CLI', desc: 'Open source, one binary, any database it can reach', href: '/#cli', icon: 'terminal'},
          {label: 'Auto tuning', desc: 'Every engine set up for its machine', href: '/how#tuning', icon: 'sliders'},
        ],
      },
      {
        title: 'Keep measuring',
        items: [
          {label: 'Suites & schedules', desc: 'Compare variants at once, catch regressions nightly', href: '/how#suites', icon: 'layers'},
          {label: 'Compare & share', desc: 'Runs side by side, reports by a public link', href: '/how#share', icon: 'share'},
          {label: 'API & CI', desc: 'Launch from a pipeline, hear back by webhook', href: '/how#api', icon: 'code'},
        ],
      },
    ],
    promo: {
      kind: 'art',
      title: 'How Stroppy Cloud works',
      body: 'What you describe, what comes up for you, and what stays after the run.',
      href: '/how',
      cta: 'See how it works',
    },
  },
  {
    id: 'benchmarks',
    label: 'Benchmarks',
    href: '/#results',
    columns: [
      {
        title: 'Published results',
        items: [
          {label: 'Leaderboard', desc: 'Every public run, filter by engine and hardware', href: '/#results', icon: 'award'},
          {label: 'Protocol conformity', desc: 'Which databases really speak the protocol they claim', href: '/conformity', icon: 'activity'},
          {label: 'In Stroppy Cloud', desc: 'The leaderboard full screen, every filter', href: `${CLOUD}/leaderboard`, icon: 'chart'},
        ],
      },
      {
        title: 'Studies',
        items: [
          {label: 'Client overhead', desc: 'How fast the load generator itself is', href: '/#evidence', icon: 'zap'},
          {label: 'Case studies', desc: 'Benchmarks and what we learned from them', href: '/blog', icon: 'pen'},
        ],
      },
    ],
    promo: {
      kind: 'board',
      title: 'Who is ahead right now',
      body: 'Published runs on the same workload, each with its full report.',
      href: '/#results',
      cta: 'Open the leaderboard',
    },
  },
  {
    id: 'docs',
    label: 'Docs',
    href: '/docs/introduction',
    columns: [
      {
        title: 'Learn',
        items: [
          {label: 'Getting started', desc: 'Install Stroppy and run a first test', href: '/docs/introduction', icon: 'play'},
          {label: 'Documentation', desc: 'Drivers, configs, presets, reports', href: '/docs/cli-reference', icon: 'book'},
          {label: 'Workloads', desc: 'TPC-B, TPC-C, TPC-H and TPC-DS in detail', href: '/docs/tests/tpcb', icon: 'list'},
          {label: 'Changelog', desc: 'What changed in every release', href: '/docs/next/changelog', icon: 'clock'},
        ],
      },
      {
        title: 'Community',
        items: [
          {label: 'Blog', desc: 'Engineering notes and benchmark write-ups', href: '/blog', icon: 'pen'},
          {label: 'Discord', desc: 'Ask the team and other users', href: 'https://discord.gg/2mSSrkBkHm', icon: 'chat'},
          {label: 'GitHub', desc: 'Source, issues and releases', href: 'https://github.com/stroppy-io/stroppy', icon: 'github'},
        ],
      },
    ],
    promo: {
      kind: 'art',
      title: 'Why Stroppy moved off k6',
      body: 'One Go binary instead of k6 and TypeScript, and what it did to the numbers.',
      href: '/blog/why-stroppy-moved-off-k6',
      cta: 'Read the post',
    },
  },
];
