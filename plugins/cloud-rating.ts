import type {LoadContext, Plugin} from '@docusaurus/types';
import {fetchRating, type Rating} from '../src/components/landing/rating';

// Takes a copy of Stroppy Cloud's public rating when the site is built (and
// when the dev server starts), so the landing's board is in the HTML. The
// page refreshes it in the browser. If the cloud does not answer, the build
// goes on and the board shows a link instead of rows.

export default function cloudRating(_context: LoadContext): Plugin<Rating | null> {
  return {
    name: 'cloud-rating',
    async loadContent() {
      try {
        return await fetchRating(AbortSignal.timeout(10_000));
      } catch (err) {
        console.warn(`[cloud-rating] no rating at build time: ${(err as Error).message}`);
        return null;
      }
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData({rating: content});
    },
  };
}
