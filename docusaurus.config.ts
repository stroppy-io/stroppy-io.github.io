import prismStroppy from './src/prism-stroppy';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {normalizeUrl, simpleHash} from '@docusaurus/utils';
import {addTrailingSlash} from '@docusaurus/utils-common';

const url = 'https://stroppy.io';
const baseUrl = '/';

// Where Docusaurus keeps the colour mode: its storage key carries a namespace
// hashed from the site's address (future.v4), computed here the way
// @docusaurus/core's server/storage.js does.
const themeStorageKey = `theme-${simpleHash(addTrailingSlash(normalizeUrl([url, baseUrl])), 3)}`;

const config: Config = {
  title: 'Stroppy',
  tagline: 'Go-native database stress testing',
  // Stroppy Cloud's favicon (scripts/sync-kit.mjs), so both sites show one icon.
  favicon: 'kit/favicon.svg',

  future: {
    v4: true,
  },

  url,
  baseUrl,

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

  plugins: ['docusaurus-plugin-llms', './plugins/cloud-rating.ts', './plugins/conformity.ts'],

  // The theme the visitor picked on stroppy.io or in Stroppy Cloud, from the
  // shared cookie, before Docusaurus reads its storage (src/client/theme-cookie.ts).
  headTags: [
    {
      tagName: 'script',
      attributes: {},
      innerHTML:
        `try{var m=document.cookie.match(/(?:^|; )stroppy-theme=(dark|light)/);if(m)localStorage.setItem('${themeStorageKey}',m[1])}catch(e){}`,
    },
  ],
  clientModules: ['./src/client/theme-cookie.ts', './src/client/theme-color.ts'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/stroppy-io/stroppy-io.github.io/edit/next/',
          lastVersion: '6.2.0',
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
            './src/css/nav.css',
            './src/css/footer.css',
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
        // Mega menus: src/components/nav/menu.ts.
        {type: 'custom-mega', section: 'benchmarks', position: 'left'},
        {type: 'custom-mega', section: 'how', position: 'left'},
        {type: 'custom-mega', section: 'docs', position: 'left'},
        // Sign in and Try Stroppy Cloud, or Open console: src/components/nav/Account.tsx.
        // The docs version switch is in the docs sidebar (src/theme/DocSidebar),
        // the theme switch, GitHub and Discord in the footer.
        {type: 'custom-account', position: 'right'},
      ],
    },
    // The footer is the site's own (src/theme/Footer): a site map built from
    // the top menu (src/components/nav/menu.ts) and the copyright below.
    footer: {
      copyright: `© ${new Date().getFullYear()} Stroppy Authors · Apache 2.0 License`,
    },
    prism: {
      theme: prismStroppy,
      darkTheme: prismStroppy,
      additionalLanguages: ['bash', 'typescript', 'sql', 'go', 'protobuf', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
