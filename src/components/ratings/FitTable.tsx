import {Fragment, type CSSProperties, type ReactNode} from 'react';
import clsx from 'clsx';
import {percent, stateInfo} from '../conformity/data';
import type {Row} from '../conformity/types';
import {breaksOf, type Band, type EngineRun, type ToolFit} from './fit';

// Every engine that claims the protocol, grouped by what it means for the
// reader: answers like the original, answers some of it differently, breaks
// on some of it. Columns: the reader's tools, the score against the
// original, the engine's benchmarks where Stroppy Cloud ran it (a bar each
// against the best run of that workload in the table), and the crashes and
// hangs during the checks. A row opens in place (EngineDetail), with the
// parts of its score.

export type Fit = {
  row: Row;
  band: Band;
  /** Per picked tool, how it fares on this engine. */
  cells: ToolFit[];
  runs: EngineRun[];
  /** TPC-C tpmC as a share of the original's on the same machine. */
  share?: number;
};

type Props = {
  original: string;
  tools: string[];
  fits: Fit[];
  bands: {band: Band; title: string}[];
  open: string | null;
  onOpen: (id: string | null) => void;
  detail: (f: Fit) => ReactNode;
};

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** A score out of 100 with a bar as long and a tick where we call an engine compatible. */
function Score({value}: {value: number | null | undefined}) {
  if (typeof value !== 'number') return <span className="rp-none">no score</span>;
  return (
    <span className="rp-score" style={{'--v': value} as CSSProperties}>
      <b>{percent(value)}</b>
      <span className="rp-score__track" aria-hidden="true" />
    </span>
  );
}

/** A tool on an engine: the worst state's glyph and how many of its features answered like the original. */
function ToolCell({fit, where}: {fit: ToolFit; where: string}) {
  const info = stateInfo(fit.state);
  const words = fit.of ? `${fit.same} of ${fit.of} features answered like the original` : 'not measured';
  return (
    <td className={clsx('rp-tool', fit.of ? `c--${fit.state}` : 'c--none')} title={`${where}: ${info.label}, ${words}`}>
      {fit.of > 0 ? (
        <>
          <span className="c__glyph" aria-hidden="true">
            {info.glyph}
          </span>
          <span aria-hidden="true">
            {fit.same}/{fit.of}
          </span>
        </>
      ) : (
        <span aria-hidden="true">·</span>
      )}
      <span className="sr">
        {info.label}, {words}
      </span>
    </td>
  );
}

/** The best run of each workload among the engines shown: the end of every speed bar. */
export type Bests = Record<string, number>;

export function bestsOf(fits: Fit[]): Bests {
  const out: Bests = {};
  for (const {runs} of fits)
    for (const {label, run, higher} of runs) {
      const was = out[label];
      out[label] = was === undefined ? run.value : higher ? Math.max(was, run.value) : Math.min(was, run.value);
    }
  return out;
}

/**
 * The engine's runs, a bar each against the best of that workload among
 * the engines shown (the shortest time is the best where lower is better),
 * the number and unit beside it; TPC-C also against the original.
 */
function Speed({fit, bests, original}: {fit: Fit; bests: Bests; original: string}) {
  if (fit.runs.length === 0) return <span className="rp-none">not run</span>;
  return (
    <span className="rp-runs">
      {fit.runs.map(({label, run, higher}) => {
        const best = bests[label] ?? run.value;
        const share = higher ? run.value / best : best / run.value;
        return (
          <span key={label} className="rp-run" style={{'--v': share * 100} as CSSProperties}>
            <span className="rp-run__what">{label}</span>
            <span className="rp-run__track" aria-hidden="true" />
            <span className="rp-run__value">
              {fmt(run.value)} <span className="rp-run__unit">{run.unit}</span>
              {label === 'TPC-C' && fit.share !== undefined && (
                <span className="rp-run__unit">
                  {' '}
                  · {Math.round(fit.share * 100)}% of {original}
                </span>
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export default function FitTable({original, tools, fits, bands, open, onOpen, detail}: Props) {
  const bests = bestsOf(fits);
  const span = 4 + tools.length;
  return (
    <div className="rp-table-box">
      <table className="rp-table">
        <thead>
          <tr>
            <th scope="col" className="rp-table__engine">
              Engine
            </th>
            {tools.map((c) => (
              <th key={c} scope="col" className="rp-table__col">
                {c}
              </th>
            ))}
            <th scope="col" className="rp-table__score">
              Like {original}
            </th>
            <th scope="col" className="rp-table__speed">
              Benchmarks, against the best here
            </th>
            <th
              scope="col"
              className="rp-table__fail"
              title="Crashes, hangs, unresponsive sessions and broken protocol messages during the checks">
              Crashes, hangs
            </th>
          </tr>
        </thead>
        {bands.map(({band, title}) => {
          const rows = fits.filter((f) => f.band === band);
          if (rows.length === 0) return null;
          return (
            <tbody key={band} className={`rp-band rp-band--${band}`}>
              <tr className="rp-band__head">
                <th scope="rowgroup" colSpan={span}>
                  {title} <span className="rp-band__n">{rows.length}</span>
                </th>
              </tr>
              {rows.map((f) => {
                const isOpen = open === f.row.id;
                const breaks = breaksOf(f.row);
                return (
                  <Fragment key={f.row.id}>
                    <tr className={clsx('rp-row', isOpen && 'is-open')}>
                      <th scope="row" className="rp-table__engine">
                        <button type="button" aria-expanded={isOpen} onClick={() => onOpen(isOpen ? null : f.row.id)}>
                          <span className="rp-row__name">{f.row.target}</span>
                          <span className="rp-row__ver">{f.row.variant ? `${f.row.claims} · ${f.row.variant}` : f.row.claims}</span>
                        </button>
                      </th>
                      {f.cells.map((c, i) => (
                        <ToolCell key={tools[i]} fit={c} where={`${tools[i]} on ${f.row.target}`} />
                      ))}
                      <td className="rp-table__score">
                        <Score value={f.row.scores.overall} />
                      </td>
                      <td className="rp-table__speed">
                        <Speed fit={f} bests={bests} original={original} />
                      </td>
                      <td className={clsx('rp-table__fail', breaks > 0 && 'is-bad')}>{breaks || '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr className="rp-detail-row">
                        <td colSpan={span}>{detail(f)}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
