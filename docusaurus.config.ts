import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Stroppy',
  tagline: 'Database stress testing powered by k6',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://stroppy-io.github.io',
  baseUrl: '/',

  organizationName: 'stroppy-io',
  projectName: 'stroppy-docs',

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
          editUrl: 'https://github.com/stroppy-io/stroppy-docs/tree/main/',
          lastVersion: '5.1.2',
          versions: {
            current: {
              label: 'Next',
              path: 'next',
            },
          },
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/stroppy-io/stroppy-docs/tree/main/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/stroppy-social-card.png',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Stroppy',
      logo: {
        alt: 'Stroppy Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          to: '/docs/tests/tpcc',
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
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Introduction', to: '/docs/introduction'},
            {label: 'SQL & Generators', to: '/docs/sql-and-generators'},
            {label: 'Extensibility', to: '/docs/extensibility'},
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
      theme: prismThemes.vsLight,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'typescript', 'sql', 'go', 'protobuf', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
