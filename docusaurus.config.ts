import prismStroppy from './src/prism-stroppy';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Stroppy',
  tagline: 'Go-native database stress testing',
  // Stroppy Cloud's favicon (scripts/sync-kit.mjs), so both sites show one icon.
  favicon: 'kit/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://stroppy.io',
  baseUrl: '/',

  organizationName: 'stroppy-io',
  projectName: 'stroppy-io.github.io',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  themes: [
    ['@easyops-cn/docusaurus-search-local', {
      indexDocs: true,
      indexBlog: true,
      indexPages: false,
      hashed: true,
      language: ['en'],
    }],
  ],

  plugins: ['docusaurus-plugin-llms'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/stroppy-io/stroppy-io.github.io/edit/next/',
          lastVersion: '6.0.0',
          versions: {
            current: {
              label: 'Next',
              path: 'next',
            },
          },
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/stroppy-io/stroppy-io.github.io/edit/next/',
        },
        theme: {
          // The Stroppy UI kit (scripts/sync-kit.mjs), then the site's mapping onto it.
          customCss: [
            './src/kit/tokens.css',
            './src/kit/fonts.css',
            './src/kit/base.css',
            './src/css/custom.css',
          ],
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'kit/mark-dark.svg',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Stroppy',
      logo: {
        alt: 'Stroppy Logo',
        src: 'kit/mark-light.svg',
        srcDark: 'kit/mark-dark.svg',
      },
      items: [
        {
          to: '/docs/tests/tpcb',
          label: 'Tests',
          position: 'left',
          activeBaseRegex: '/docs/tests/.*',
        },
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/blog',
          label: 'Blog',
          position: 'left',
        },
        {
          type: 'docSidebar',
          sidebarId: 'legacySidebar',
          position: 'left',
          label: 'Legacy',
        },
        {
          // Plain link to the full changelog (Next = all releases + Unreleased).
          // Not a version-aware `type: doc` item — older versions have no
          // changelog page and onBrokenLinks: 'throw' would fail the build.
          to: '/docs/next/changelog',
          label: 'Changelog',
          position: 'right',
          activeBaseRegex: '/docs/.*/changelog',
        },
        {
          href: 'https://cloud.stroppy.io',
          label: 'Cloud',
          position: 'right',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
          dropdownActiveClassDisabled: true,
        },
        {
          href: 'https://github.com/stroppy-io/stroppy',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
        {
          href: 'https://discord.gg/2mSSrkBkHm',
          position: 'right',
          className: 'header-discord-link',
          'aria-label': 'Discord server',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Introduction', to: '/docs/introduction'},
            {label: 'Migrating to v6', to: '/docs/migration-v6'},
            {label: 'Built-in Workloads', to: '/docs/presets'},
            {label: 'Machine Baseline', to: '/docs/baseline'},
            {label: 'Reports & Workflow', to: '/docs/reports-workflow'},
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/2mSSrkBkHm',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/stroppy-io/stroppy',
            },
            {
              label: 'Releases',
              href: 'https://github.com/stroppy-io/stroppy/releases',
            },
          ],
        },
        {
          title: 'Legacy',
          items: [
            {label: 'Historical Overview', to: '/docs/legacy/overview'},
            {label: 'FoundationDB Report', to: '/docs/legacy/fdb-report'},
            {label: 'MongoDB Report', to: '/docs/legacy/mongodb-report'},
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Stroppy Authors. Apache 2.0 License.`,
    },
    prism: {
      theme: prismStroppy,
      darkTheme: prismStroppy,
      additionalLanguages: ['bash', 'typescript', 'sql', 'go', 'protobuf', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
