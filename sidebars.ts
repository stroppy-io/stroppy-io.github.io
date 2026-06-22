import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'introduction',
    'sql-and-generators',
    'drivers',
    'config-file',
    'transactions',
    'extensibility',
    'probe',
    'presets',
    'cli-reference',
    'reports-workflow',
    'mcp',
    'changelog',
  ],
  legacySidebar: [
    {
      type: 'category',
      label: 'Legacy Releases',
      collapsible: true,
      collapsed: false,
      items: [
        'legacy/overview',
        'legacy/user-guide',
        'legacy/fdb-report',
        'legacy/mongodb-report',
      ],
    },
  ],
};

export default sidebars;
