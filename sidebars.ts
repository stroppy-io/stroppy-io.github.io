import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'introduction',
    'sql-and-generators',
    'extensibility',
    'reports-workflow',
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
