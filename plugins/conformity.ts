import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {LoadContext, Plugin} from '@docusaurus/types';
import {groupCell, groupsOf, mergeCells, protocolsOf, rowsOf, type Cell} from '../src/components/conformity/data';
import type {Compat} from '../src/components/conformity/types';

// A small summary of the conformity dataset (static/data/conformity, see
// scripts/extract-conformity.mjs) for the landing's preview of the map, so
// the landing does not carry the whole compat.json; /conformity imports that
// itself. Per protocol, in /conformity's tab order: its feature groups, the
// references as one row and the best engines, their cells already
// aggregated by group the way /conformity's map does it.

const TOP = 5;

export type ConformitySummary = {
  dataset: string;
  auditedAt?: string;
  protocols: {
    protocol: string;
    /** How many engines claim it. */
    engines: number;
    /** Feature group names, in map order. */
    groups: string[];
    ref: {targets: string[]; cells: Cell[]};
    rows: {id: string; target: string; score: number; cells: Cell[]}[];
  }[];
};

export default function conformity(context: LoadContext): Plugin<ConformitySummary | null> {
  return {
    name: 'conformity',
    async loadContent() {
      const file = path.join(context.siteDir, 'static/data/conformity/compat.json');
      let compat: Compat;
      try {
        compat = JSON.parse(await readFile(file, 'utf8')) as Compat;
      } catch (err) {
        console.warn(`[conformity] no dataset: ${(err as Error).message}`);
        return null;
      }
      return {
        dataset: compat.dataset.id,
        auditedAt: compat.dataset.audited_at,
        protocols: protocolsOf(compat).map((protocol) => {
          const groups = groupsOf(compat, protocol);
          const {refs, subjects} = rowsOf(compat, protocol);
          return {
            protocol,
            engines: subjects.length,
            groups: groups.map((g) => g.name),
            ref: {
              targets: refs.map((r) => r.target),
              cells: groups.map((g) => mergeCells(refs.map((r) => groupCell(r, g)))),
            },
            rows: subjects
              .filter((r) => typeof r.scores.overall === 'number')
              .slice(0, TOP)
              .map((r) => ({id: r.id, target: r.target, score: r.scores.overall as number, cells: groups.map((g) => groupCell(r, g))})),
          };
        }),
      };
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData({summary: content});
    },
  };
}
