import type {LoadContext, Plugin} from '@docusaurus/types';
import {fetchCatalog, fetchRating, type Catalog, type Rating} from '../src/components/landing/rating';

// Takes a copy of Stroppy Cloud's public rating and catalog when the site is
// built (and when the dev server starts), so the landing's board and its
// line of engines are in the HTML. The page refreshes the rating in the
// browser. If the cloud does not answer, the build goes on without them.

type Content = {rating: Rating | null; catalog: Catalog | null};

async function load<T>(what: string, get: (s: AbortSignal) => Promise<T>): Promise<T | null> {
  try {
    return await get(AbortSignal.timeout(10_000));
  } catch (err) {
    console.warn(`[cloud-rating] no ${what} at build time: ${(err as Error).message}`);
    return null;
  }
}

export default function cloudRating(_context: LoadContext): Plugin<Content> {
  return {
    name: 'cloud-rating',
    async loadContent() {
      const [rating, catalog] = await Promise.all([load('rating', fetchRating), load('catalog', fetchCatalog)]);
      return {rating, catalog};
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData(content);
    },
  };
}
