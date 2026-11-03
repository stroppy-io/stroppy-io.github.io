import type {CSSProperties} from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';
import type {ConformitySummary} from '@site/plugins/conformity';

// Every engine that claims a protocol, as one bar each of its overall score
// against the original, with a line at the bar a reader would call
// compatible. The scores come from plugins/conformity.ts.

/** The score a reader would call compatible: the line on the bars and the count beside them. */
export const COMPATIBLE = 80;

export function useCompat(protocol: string): {target: string; score: number}[] {
  const {summary} = usePluginData('conformity') as {summary: ConformitySummary | null};
  return summary?.protocols.find((p) => p.protocol === protocol)?.scores ?? [];
}

export default function CompatSpread({protocol}: {protocol: string}) {
  const scores = useCompat(protocol);
  if (scores.length === 0) return null;
  return (
    <figure className="spread" style={{'--line': `${COMPATIBLE}%`} as CSSProperties}>
      <ol className="spread__rows">
        {scores.map((s) => (
          <li key={s.target} className={s.score >= COMPATIBLE ? 'spread__row spread__row--ok' : 'spread__row'}>
            <span className="spread__name">{s.target}</span>
            <span className="spread__track" aria-hidden="true">
              <i style={{width: `${s.score}%`}} />
            </span>
            <span className="spread__value">{Number.isInteger(s.score) ? s.score : s.score.toFixed(1)}</span>
          </li>
        ))}
      </ol>
      <figcaption className="spread__axis" aria-hidden="true">
        <span />
        <span className="spread__ticks">
          <span style={{left: 0}}>0</span>
          <span style={{left: `${COMPATIBLE}%`}}>{COMPATIBLE}</span>
          <span style={{left: '100%'}}>100</span>
        </span>
        <span />
      </figcaption>
    </figure>
  );
}
