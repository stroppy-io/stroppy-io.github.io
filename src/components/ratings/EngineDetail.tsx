import Link from '@docusaurus/Link';
import clsx from 'clsx';
import {day, mapUrl, percent, stateInfo, stateOfOutcome} from '../conformity/data';
import type {ForkRow, Row} from '../conformity/types';
import {shareUrl} from '../landing/rating';
import {breaksOf, partName, toolFit, type Tool} from './fit';
import type {Legend} from '../conformity/types';
import type {Fit} from './FitTable';

// One engine, opened in place under its row: every tool the checks cover
// and how this engine answers it (a tool pressed here joins the reader's
// tools), the parts of its score with the export's own words, its worst
// findings, and where it comes from.

type Props = {
  fit: Fit;
  legend: Legend;
  original: string;
  tools: Tool[];
  picked: string[];
  parts: string[];
  fork?: ForkRow;
  onTool: (name: string) => void;
};

export default function EngineDetail({fit, legend, original, tools, picked, parts, fork, onTool}: Props) {
  const {row} = fit;
  const breaks = breaksOf(row);
  return (
    <div className="rp-detail">
      <section className="rp-detail__tools" aria-label={`Tools on ${row.target}`}>
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
      </section>

      <section className="rp-detail__parts" aria-label="The parts of the score">
        <h3>Where it differs from {original}</h3>
        <dl className="rp-parts">
          {parts.map((p) => (
            <div key={p}>
              <dt>
                {partName(p)} <b>{percent(row.scores[p])}</b>
              </dt>
              <dd title={row.explain?.[p]}>{row.explain?.[p]?.split(";")[0]}</dd>
            </div>
          ))}
        </dl>
        {row.top_findings.length > 0 && (
          <ul className="rp-findings">
            {row.top_findings.slice(0, 4).map((f) => {
              const s = stateOfOutcome(f.outcome);
              return (
                <li key={f.id} className={`c--${s}`}>
                  <span className="c__glyph" aria-hidden="true">
                    {stateInfo(s).glyph}
                  </span>
                  {f.summary}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rp-detail__facts" aria-label="How it was measured">
        <p>
          Checked {day(row.measured_at)} against {row.baseline.reference}: {row.baseline.reason}.
          {breaks > 0 && ` The server crashed, hung or broke a message ${breaks} ${breaks === 1 ? 'time' : 'times'}.`}
        </p>
        {fork?.lineage && (
          <p>
            A fork of {fork.upstream === 'postgresql' ? 'PostgreSQL' : fork.upstream}: {fork.lineage}.
          </p>
        )}
        <p className="rp-detail__links">
          <Link to={mapUrl({protocol: row.protocol, engine: row.id})}>Every finding on the conformity map</Link>
          {fit.runs.map(({label, run, topology}) => (
            <a key={label} href={shareUrl(run)} target="_blank" rel="noopener noreferrer">
              The {label} run report, {topology}
            </a>
          ))}
        </p>
      </section>
    </div>
  );
}
