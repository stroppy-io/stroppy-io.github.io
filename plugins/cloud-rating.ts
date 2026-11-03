import type {LoadContext, Plugin} from '@docusaurus/types';
import {fetchRating, SCENARIO, SCENARIO_PROCS, type Rating} from '../src/components/landing/rating';

// Takes a copy of Stroppy Cloud's public rating when the site is built (and
// when the dev server starts), so the landing's board and /ratings are in the
// HTML. Pages refresh it in the browser. If the cloud does not answer, the
// build goes on without it.

/** TPC-C as one round trip per statement (`rating`) and with stored procedures (`procs`). */
export type CloudRating = {rating: Rating | null; procs: Rating | null};

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
      const [rating, procs] = await Promise.all([
        load(SCENARIO, (s) => fetchRating(SCENARIO, s)),
        load(SCENARIO_PROCS, (s) => fetchRating(SCENARIO_PROCS, s)),
      ]);
      return {rating, procs};
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData(content);
    },
  };
}
