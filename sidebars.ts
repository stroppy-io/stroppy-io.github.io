import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'introduction',
    'migration-v6',
    'sql-and-generators',
    'drivers',
    'config-file',
    'transactions',
    'presets',
    'probe',
    'baseline',
    'reports-workflow',
    'run-reports',
    'extensibility',
    'custom-workloads',
    'cli-reference',
    'changelog',
  ],
  testsSidebar: [
    'tests/tpcb',
    'tests/tpcc',
    'tests/tpch',
    'tests/tpcds',
    'tests/banking',
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
