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
      indexBlog: false,
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
          lastVersion: '1.0.0',
          versions: {
            current: {
              label: 'Next',
              path: 'next',
            },
            '1.0.0': {
              label: '1.0.0',
            },
          },
        },
        blog: false,
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
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'legacySidebar',
          position: 'left',
          label: 'Legacy',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
          dropdownActiveClassDisabled: true,
        },
        {
          href: 'https://github.com/stroppy-io/stroppy',
          label: 'GitHub',
          position: 'right',
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
          title: 'Project',
          items: [
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
