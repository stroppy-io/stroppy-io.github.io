import {useEffect, useState} from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';
import type {CloudRating} from '@site/plugins/cloud-rating';
import {fetchRating, SCENARIO, SCENARIO_PROCS} from './rating';

/** The build's copy of both TPC-C ratings, refreshed from the cloud once the page is up. */
export default function useRatings(): CloudRating {
  const built = usePluginData('cloud-rating') as CloudRating;
  const [live, setLive] = useState(built);
  useEffect(() => {
    const ac = new AbortController();
    Promise.all([fetchRating(SCENARIO, ac.signal), fetchRating(SCENARIO_PROCS, ac.signal)])
      .then(([rating, procs]) => setLive({rating, procs}))
      .catch(() => undefined);
    return () => ac.abort();
  }, []);
  return live;
}
