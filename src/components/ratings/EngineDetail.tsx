import clsx from 'clsx';
import {stateInfo} from '../conformity/data';
import type {ForkRow, Legend, Row} from '../conformity/types';
import {shareUrl} from '../landing/rating';
import {toolFit, type EngineRun, type Tool} from './fit';

// What /ratings knows about an engine beside the conformity export, shown in
// the export's own side panel (conformity/Drawer.tsx) under the scores: every
// tool the checks cover and how this engine answers it (pressing one adds it
// to the reader's tools), the engine's runs with their reports, and where a
// fork comes from.

type Props = {
  row: Row;
  legend: Legend;
  original: string;
  tools: Tool[];
  picked: string[];
  runs: EngineRun[];
  fork?: ForkRow;
  onTool: (name: string) => void;
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function EngineDetail({row, legend, original, tools, picked, runs, fork, onTool}: Props) {
  return (
    <div className="rp-detail">
      {fork?.lineage && (
        <p className="rp-detail__note">
          A fork of {fork.upstream === 'postgresql' ? 'PostgreSQL' : fork.upstream}: {fork.lineage}.
        </p>
      )}

      {runs.length > 0 && (
        <>
          <h3>Benchmarks</h3>
          <ul className="rp-detail__runs">
            {runs.map(({label, run, topology}) => (
              <li key={label}>
                <span>
                  {label} · {topology}
                </span>
                <a href={shareUrl(run)} target="_blank" rel="noopener noreferrer">
                  {fmt(run.value)} {run.unit}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {tools.length > 0 && (
        <>
          <h3>Every tool we check, on {row.target}</h3>
          <ul className="rp-pills">
            {tools.map((t) => {
              const tf = toolFit(legend, row, t);
              const info = stateInfo(tf.state);
              const on = picked.includes(t.name);
              return (
                <li key={t.name}>
                  <button
                    type="button"
                    className={clsx('rp-pill', `c--${tf.state}`, on && 'is-on')}
                    aria-pressed={on}
                    title={`${tf.of ? `${tf.same} of ${tf.of} features answered like ${original}` : 'Not measured'}. Press to ${on ? 'drop it from' : 'add it to'} your tools.`}
                    onClick={() => onTool(t.name)}>
                    <span className="c__glyph" aria-hidden="true">
                      {info.glyph}
                    </span>
                    {t.name}
                    <span className="sr">, {info.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
