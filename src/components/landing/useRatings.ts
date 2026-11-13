import {useEffect, useState} from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';
import type {CloudRating} from '@site/plugins/cloud-rating';
import {fetchRating, SCENARIOS} from './rating';

/** The build's copy of every scenario's rating, refreshed from the cloud once the page is up. */
export default function useRatings(): CloudRating {
  const built = usePluginData('cloud-rating') as CloudRating;
  const [live, setLive] = useState(built);
  useEffect(() => {
    const ac = new AbortController();
    Promise.all(SCENARIOS.map((s) => fetchRating(s.scenario, ac.signal)))
      .then((ratings) => setLive(Object.fromEntries(SCENARIOS.map((s, i) => [s.key, ratings[i]])) as CloudRating))
      .catch(() => undefined);
    return () => ac.abort();
  }, []);
  return live;
}
