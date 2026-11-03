import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {LoadContext, Plugin} from '@docusaurus/types';
import {protocolsOf} from '../src/components/conformity/data';
import type {Compat} from '../src/components/conformity/types';

// A summary of the conformity dataset (static/data/conformity, see
// scripts/extract-conformity.mjs) for the landing, so the landing does not
// carry the whole compat.json; /tools/conformity imports that itself. Per
// protocol, in the map's tab order: every engine that claims it (not the
// originals, not a vendor switch's variant) with its overall score, best first.

export type ConformitySummary = {
  dataset: string;
  auditedAt?: string;
  protocols: {protocol: string; scores: {target: string; score: number}[]}[];
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
        protocols: protocolsOf(compat).map((protocol) => ({
          protocol,
          scores: compat.rows
            .filter((r) => r.protocol === protocol && r.role === 'subject' && !r.variant)
            .flatMap((r) => (typeof r.scores.overall === 'number' ? [{target: r.target, score: r.scores.overall}] : []))
            .sort((a, b) => b.score - a.score),
        })),
      };
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData({summary: content});
    },
  };
}
