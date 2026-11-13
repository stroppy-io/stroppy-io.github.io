import type {LoadContext, Plugin} from '@docusaurus/types';
import {fetchRating, SCENARIOS, type Rating, type ScenarioKey} from '../src/components/landing/rating';

// Takes a copy of Stroppy Cloud's public rating when the site is built (and
// when the dev server starts), so the landing's board and /ratings are in the
// HTML. Pages refresh it in the browser. If the cloud does not answer, the
// build goes on without it.

/** Every scenario the site shows (SCENARIOS in rating.ts), by its key; null when the cloud did not answer. */
export type CloudRating = Record<ScenarioKey, Rating | null>;

async function load<T>(what: string, get: (s: AbortSignal) => Promise<T>): Promise<T | null> {
  try {
    return await get(AbortSignal.timeout(10_000));
  } catch (err) {
    console.warn(`[cloud-rating] no ${what} at build time: ${(err as Error).message}`);
    return null;
  }
}

export default function cloudRating(_context: LoadContext): Plugin<CloudRating> {
  return {
    name: 'cloud-rating',
    async loadContent() {
      const ratings = await Promise.all(SCENARIOS.map((s) => load(s.scenario, (signal) => fetchRating(s.scenario, signal))));
      return Object.fromEntries(SCENARIOS.map((s, i) => [s.key, ratings[i]])) as CloudRating;
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData(content);
    },
  };
}
